const { Op } = require("sequelize");
const Purchase = require("../models/Purchase");
const PurchaseItem = require("../models/PurchaseItem");
const Supplier = require("../models/Supplier");
const Inventory = require("../models/Inventory");
const Medicine = require("../models/Medicine");
const sequelize = require("../config/database");

function calculatePurchaseSummary(items = []) {
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalCost = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0);
  const averageUnitCost = totalQuantity > 0 ? Number((totalCost / totalQuantity).toFixed(2)) : 0;
  const totalIndividualUnits = items.reduce((sum, item) => (
    sum + (Number(item.quantity || 0) + Number(item.free_quantity || 0)) * Number(item.units_per_pack || 1)
  ), 0);

  return {
    totalQuantity,
    totalIndividualUnits,
    totalCost: Number(totalCost.toFixed(2)),
    averageUnitCost,
  };
}

async function createPurchase(payload, pharmacyId) {
  const { supplier_id, invoice_no, notes, payment_status = "Pending", items = [] } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one purchase item is required.");
  }

  const supplier = supplier_id ? await Supplier.findOne({ where: { supplier_id, pharmacy_id: pharmacyId } }) : null;
  if (supplier_id && !supplier) {
    throw new Error("Supplier not found.");
  }

  const summary = calculatePurchaseSummary(items);
  const transaction = await sequelize.transaction();
  try {
    const purchase = await Purchase.create({
      supplier_id: supplier_id || null,
      pharmacy_id: pharmacyId,
      invoice_no,
      notes,
      payment_status,
      total_amount: summary.totalCost,
      purchase_date: new Date(),
    }, { transaction });

    const createdItems = [];
    for (const item of items) {
      const {
        medicine_id,
        batch_no,
        expiry_date,
        quantity,
        free_quantity = 0,
        units_per_pack = 1,
        unit_cost,
        selling_price,
        min_stock,
        location,
        is_narcotic,
        is_schedule_h1,
        ocr_snapshot,
      } = item;

      if (!medicine_id || !batch_no || !expiry_date || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
        throw new Error("Each purchase item must include medicine_id, batch_no, expiry_date, and a positive whole-number quantity.");
      }
      if (!Number.isInteger(Number(free_quantity)) || Number(free_quantity) < 0) {
        throw new Error("Free quantity must be a non-negative whole number.");
      }
      if (!Number.isInteger(Number(units_per_pack)) || Number(units_per_pack) <= 0) {
        throw new Error("Units per Pack must be a positive whole number.");
      }

      const medicine = await Medicine.findByPk(medicine_id, { transaction });
      if (!medicine) {
        throw new Error(`Medicine ${medicine_id} not found.`);
      }

      if (is_narcotic !== undefined || is_schedule_h1 !== undefined) {
        await medicine.update({
          is_narcotic: is_narcotic !== undefined ? is_narcotic : medicine.is_narcotic,
          is_schedule_h1: is_schedule_h1 !== undefined ? is_schedule_h1 : medicine.is_schedule_h1,
        }, { transaction });
      }

      let inventoryBatch = await Inventory.findOne({
        where: {
          medicine_id,
          pharmacy_id: pharmacyId,
          batch_no,
          is_active: true,
        },
        transaction,
        lock: transaction.LOCK?.UPDATE,
      });

      if (inventoryBatch && Number(inventoryBatch.units_per_pack || 1) !== Number(units_per_pack)) {
        throw new Error(`Batch ${batch_no} already exists with a different Units per Pack value.`);
      }

      if (!inventoryBatch) {
        inventoryBatch = await Inventory.create({
          medicine_id,
          pharmacy_id: pharmacyId,
          batch_no,
          expiry_date,
          quantity: 0,
          units_per_pack: Number(units_per_pack),
          unit_cost: 0,
          selling_price: Number(selling_price || 0),
          min_stock: Number(min_stock || 5),
          location,
        }, { transaction });
      }

      const addedIndividualUnits = (Number(quantity) + Number(free_quantity)) * Number(units_per_pack);
      await inventoryBatch.update({
        quantity: Number(inventoryBatch.quantity || 0) + addedIndividualUnits,
        units_per_pack: Number(units_per_pack),
        unit_cost: Number(unit_cost || 0) / Number(units_per_pack),
        selling_price: Number(selling_price || inventoryBatch.selling_price || 0),
        expiry_date,
        min_stock: Number(min_stock || inventoryBatch.min_stock || 5),
        location,
      }, { transaction });

      const totalCost = Number(quantity) * Number(unit_cost || 0);
      const purchaseItem = await PurchaseItem.create({
        purchase_id: purchase.purchase_id,
        stock_id: inventoryBatch.stock_id,
        pharmacy_id: pharmacyId,
        quantity: Number(quantity),
        free_quantity: Number(free_quantity),
        units_per_pack: Number(units_per_pack),
        ocr_snapshot: ocr_snapshot || null,
        unit_cost: Number(unit_cost || 0),
        total_cost: totalCost,
      }, { transaction });

      createdItems.push(purchaseItem);
    }

    await transaction.commit();
    return {
      purchase,
      items: createdItems,
      summary,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listPurchases(pharmacyId) {
  return Purchase.findAll({
    where: { pharmacy_id: pharmacyId },
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["supplier_id", "supplier_name", "phone", "email"],
      },
      {
        model: PurchaseItem,
        as: "items",
        include: [
          {
            model: Inventory,
            as: "inventoryBatch",
            include: [
              {
                model: Medicine,
                as: "medicine",
                attributes: ["medicine_id", "medicine_name", "manufacturer"],
              },
            ],
          },
        ],
      },
    ],
    order: [["purchase_id", "DESC"]],
  });
}

async function getPurchaseById(purchaseId, pharmacyId) {
  return Purchase.findOne({
    where: { purchase_id: purchaseId, pharmacy_id: pharmacyId },
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["supplier_id", "supplier_name", "phone", "email"],
      },
      {
        model: PurchaseItem,
        as: "items",
        include: [
          {
            model: Inventory,
            as: "inventoryBatch",
            include: [
              {
                model: Medicine,
                as: "medicine",
                attributes: ["medicine_id", "medicine_name", "manufacturer"],
              },
            ],
          },
        ],
      },
    ],
  });
}

module.exports = {
  calculatePurchaseSummary,
  createPurchase,
  listPurchases,
  getPurchaseById,
};
