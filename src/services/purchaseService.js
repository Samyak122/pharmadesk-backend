const { Op } = require("sequelize");
const Purchase = require("../models/Purchase");
const PurchaseItem = require("../models/PurchaseItem");
const Supplier = require("../models/Supplier");
const Inventory = require("../models/Inventory");
const Medicine = require("../models/Medicine");

function calculatePurchaseSummary(items = []) {
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalCost = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0);
  const averageUnitCost = totalQuantity > 0 ? Number((totalCost / totalQuantity).toFixed(2)) : 0;

  return {
    totalQuantity,
    totalCost: Number(totalCost.toFixed(2)),
    averageUnitCost,
  };
}

async function createPurchase(payload) {
  const { supplier_id, invoice_no, notes, payment_status = "Pending", items = [] } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one purchase item is required.");
  }

  const supplier = supplier_id ? await Supplier.findByPk(supplier_id) : null;
  if (supplier_id && !supplier) {
    throw new Error("Supplier not found.");
  }

  const summary = calculatePurchaseSummary(items);
  const purchase = await Purchase.create({
    supplier_id: supplier_id || null,
    invoice_no,
    notes,
    payment_status,
    total_amount: summary.totalCost,
    purchase_date: new Date(),
  });

  const createdItems = [];
  for (const item of items) {
    const { medicine_id, batch_no, expiry_date, quantity, unit_cost, selling_price, min_stock, location } = item;

    if (!medicine_id || !batch_no || !expiry_date || !quantity) {
      throw new Error("Each purchase item must include medicine_id, batch_no, expiry_date, and quantity.");
    }

    const medicine = await Medicine.findByPk(medicine_id);
    if (!medicine) {
      throw new Error(`Medicine ${medicine_id} not found.`);
    }

    let inventoryBatch = await Inventory.findOne({
      where: {
        medicine_id,
        batch_no,
        is_active: true,
      },
    });

    if (!inventoryBatch) {
      inventoryBatch = await Inventory.create({
        medicine_id,
        batch_no,
        expiry_date,
        quantity: 0,
        unit_cost: Number(unit_cost || 0),
        selling_price: Number(selling_price || 0),
        min_stock: Number(min_stock || 5),
        location,
      });
    }

    const newQuantity = Number(inventoryBatch.quantity || 0) + Number(quantity);
    await inventoryBatch.update({
      quantity: newQuantity,
      unit_cost: Number(unit_cost || inventoryBatch.unit_cost || 0),
      selling_price: Number(selling_price || inventoryBatch.selling_price || 0),
      expiry_date,
      min_stock: Number(min_stock || inventoryBatch.min_stock || 5),
      location,
    });

    const totalCost = Number(quantity) * Number(unit_cost || 0);
    const purchaseItem = await PurchaseItem.create({
      purchase_id: purchase.purchase_id,
      stock_id: inventoryBatch.stock_id,
      quantity: Number(quantity),
      unit_cost: Number(unit_cost || 0),
      total_cost: totalCost,
    });

    createdItems.push(purchaseItem);
  }

  return {
    purchase,
    items: createdItems,
    summary,
  };
}

async function listPurchases() {
  return Purchase.findAll({
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

async function getPurchaseById(purchaseId) {
  return Purchase.findByPk(purchaseId, {
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
