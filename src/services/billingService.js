const { Op } = require("sequelize");
const sequelize = require("../config/database");
const Invoice = require("../models/Invoice");
const InvoiceItem = require("../models/InvoiceItem");
const Inventory = require("../models/Inventory");
const Medicine = require("../models/Medicine");
const Customer = require("../models/Customer");

function calculateBillTotals(items = [], gstPercent = 0, invoiceDiscountAmount = 0) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
  const itemDiscountAmount = items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
  const discountAmount = Number(invoiceDiscountAmount || itemDiscountAmount || 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = Number(((taxableAmount * Number(gstPercent || 0)) / 100).toFixed(2));
  const totalAmount = Number((taxableAmount + gstAmount).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    gstAmount,
    totalAmount,
  };
}

function allocateBatchesForInvoice(item, availableBatches = []) {
  const medicineId = item.medicine_id;
  const requestedQty = Number(item.quantity || 0);

  if (!medicineId || requestedQty <= 0) {
    throw new Error("Each invoice item requires medicine_id and a positive quantity.");
  }

  const allocations = [];
  let remainingQty = requestedQty;

  for (const batch of availableBatches) {
    if (remainingQty <= 0) {
      break;
    }

    const availableQty = Number(batch.quantity || 0);
    if (availableQty <= 0) {
      continue;
    }

    const quantityFromBatch = Math.min(availableQty, remainingQty);
    allocations.push({ batch, quantity: quantityFromBatch });
    remainingQty -= quantityFromBatch;
  }

  if (remainingQty > 0) {
    throw new Error(`Insufficient stock for medicine ${medicineId}.`);
  }

  return allocations;
}

function normalizeSale(item) {
  const quantity = Number(item.quantity || 0);
  const hasUnitBreakdown = item.sale_unit !== undefined
    || item.pack_quantity !== undefined
    || item.loose_quantity !== undefined;

  if (!hasUnitBreakdown) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Each invoice item requires medicine_id and a positive whole-number quantity.");
    }
    return { quantity, pack_quantity: 0, loose_quantity: quantity, units_per_pack: 1, usesPacks: false };
  }

  const packQuantity = Number(item.pack_quantity || 0);
  const looseQuantity = Number(item.loose_quantity || 0);
  const unitsPerPack = Number(item.units_per_pack || 0);
  if (!Number.isInteger(packQuantity) || packQuantity < 0 || !Number.isInteger(looseQuantity) || looseQuantity < 0) {
    throw new Error("Pack and loose quantities must be non-negative whole numbers.");
  }
  if (!Number.isInteger(unitsPerPack) || unitsPerPack <= 0) {
    throw new Error("Units per Pack must be a positive whole number.");
  }
  if (item.sale_unit === "pack" && (packQuantity <= 0 || looseQuantity !== 0)) {
    throw new Error("Full Pack/Strip sales require a positive pack quantity and no loose quantity.");
  }
  if (item.sale_unit === "loose" && (looseQuantity <= 0 || packQuantity !== 0)) {
    throw new Error("Loose sales require a positive individual-unit quantity and no pack quantity.");
  }
  if (item.sale_unit === "mixed" && packQuantity + looseQuantity <= 0) {
    throw new Error("Mixed sales require at least one pack or loose unit.");
  }

  const calculatedQuantity = packQuantity * unitsPerPack + looseQuantity;
  if (calculatedQuantity <= 0 || quantity !== calculatedQuantity) {
    throw new Error("Invoice quantity must equal packs × Units per Pack plus loose units.");
  }
  return {
    quantity: calculatedQuantity,
    pack_quantity: packQuantity,
    loose_quantity: looseQuantity,
    units_per_pack: unitsPerPack,
    usesPacks: packQuantity > 0,
  };
}

function allocateBatchesForSale(sale, availableBatches = []) {
  const allocations = new Map();
  let packsRemaining = sale.pack_quantity;
  let looseRemaining = sale.loose_quantity;

  if (sale.usesPacks) {
    for (const batch of availableBatches) {
      if (Number(batch.units_per_pack || 1) !== sale.units_per_pack) continue;
      const available = Number(batch.quantity || 0);
      const packsFromBatch = Math.min(Math.floor(available / sale.units_per_pack), packsRemaining);
      if (!packsFromBatch) continue;
      allocations.set(batch, {
        quantity: packsFromBatch * sale.units_per_pack,
        pack_quantity: packsFromBatch,
        loose_quantity: 0,
      });
      packsRemaining -= packsFromBatch;
    }
    if (packsRemaining > 0) {
      throw new Error(`Insufficient full-pack stock for medicine ${sale.medicine_id}.`);
    }
  }

  for (const batch of availableBatches) {
    if (sale.usesPacks && Number(batch.units_per_pack || 1) !== sale.units_per_pack) continue;
    const alreadyAllocated = allocations.get(batch)?.quantity || 0;
    const available = Number(batch.quantity || 0) - alreadyAllocated;
    const looseFromBatch = Math.min(available, looseRemaining);
    if (!looseFromBatch) continue;
    const allocation = allocations.get(batch) || { quantity: 0, pack_quantity: 0, loose_quantity: 0 };
    allocation.quantity += looseFromBatch;
    allocation.loose_quantity += looseFromBatch;
    allocations.set(batch, allocation);
    looseRemaining -= looseFromBatch;
    if (!looseRemaining) break;
  }

  if (looseRemaining > 0) {
    throw new Error(`Insufficient stock for medicine ${sale.medicine_id}.`);
  }

  return [...allocations.entries()].map(([batch, allocation]) => ({ batch, ...allocation }));
}

async function createInvoice(payload, pharmacyId) {
  const {
    customer_id,
    invoice_no,
    invoice_date,
    items = [],
    payment_method = "Cash",
    payment_status = "Paid",
    gst_percent = 0,
    discount_amount = 0,
    notes,
  } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one invoice item is required.");
  }
  const normalizedItems = items.map((item) => ({ ...item, ...normalizeSale(item) }));

  if (customer_id) {
    const customer = await Customer.findOne({ where: { customer_id, pharmacy_id: pharmacyId } });
    if (!customer) {
      throw new Error("Customer not found.");
    }
  }

  const existingInvoice = await Invoice.findOne({
    where: { pharmacy_id: pharmacyId, invoice_no },
  });

  if (existingInvoice) {
    throw new Error("Invoice number already exists in your pharmacy.");
  }

  const totals = calculateBillTotals(normalizedItems, gst_percent, discount_amount);
  const transaction = await sequelize.transaction();

  try {
    const invoice = await Invoice.create(
      {
        customer_id: customer_id || null,
        pharmacy_id: pharmacyId,
        invoice_no,
        invoice_date: invoice_date || new Date(),
        total_amount: totals.totalAmount,
        discount_amount: totals.discountAmount,
        gst_amount: totals.gstAmount,
        payment_method,
        payment_status,
        notes,
      },
      { transaction }
    );

    const createdItems = [];

    for (const item of normalizedItems) {
      const medicineId = item.medicine_id;
      const requestedQty = item.quantity;
      if (!medicineId || requestedQty <= 0) {
        throw new Error("Each invoice item requires medicine_id and a positive quantity.");
      }

      const medicine = await Medicine.findByPk(medicineId, { transaction });
      if (!medicine) {
        throw new Error(`Medicine ${medicineId} not found.`);
      }

      let availableBatches = await Inventory.findAll({
        where: {
          medicine_id: medicineId,
          pharmacy_id: pharmacyId,
          is_active: true,
          quantity: { [Op.gt]: 0 },
        },
        order: [["expiry_date", "ASC"]],
        transaction,
      });
      const sale = { ...item, medicine_id: medicineId };
      if (sale.usesPacks) {
        availableBatches = availableBatches.filter((batch) => Number(batch.units_per_pack || 1) === sale.units_per_pack);
      }

      if (availableBatches.length === 0) {
        throw new Error(`No available stock for medicine ${medicineId}.`);
      }

      const allocations = allocateBatchesForSale(sale, availableBatches);
      const invoiceItemPayloads = [];

      for (const allocation of allocations) {
        const batch = allocation.batch;
        const quantityFromBatch = allocation.quantity;
        const unitPrice = Number(item.unit_price || batch.selling_price || 0);
        const totalPrice = Number((quantityFromBatch * unitPrice).toFixed(2));

        await batch.update({ quantity: Number(batch.quantity || 0) - quantityFromBatch }, { transaction });

        invoiceItemPayloads.push({
          invoice_id: invoice.invoice_id,
          stock_id: batch.stock_id,
          pharmacy_id: pharmacyId,
          quantity: quantityFromBatch,
          pack_quantity: allocation.pack_quantity,
          loose_quantity: allocation.loose_quantity,
          units_per_pack: sale.units_per_pack,
          unit_price: unitPrice,
          total_price: totalPrice,
          is_narcotic: Boolean(medicine?.is_narcotic ?? item.is_narcotic ?? false),
          is_schedule_h1: Boolean(medicine?.is_schedule_h1 ?? item.is_schedule_h1 ?? false),
        });
      }

      const savedItems = await InvoiceItem.bulkCreate(invoiceItemPayloads, { transaction });
      createdItems.push(...savedItems);
    }

    await transaction.commit();
    return {
      invoice,
      items: createdItems,
      totals,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listInvoices(pharmacyId) {
  return Invoice.findAll({
    where: { pharmacy_id: pharmacyId },
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["customer_id", "customer_name", "phone"],
      },
      {
        model: InvoiceItem,
        as: "items",
        include: [
          {
            model: Inventory,
            as: "inventoryBatch",
            include: [
              {
                model: Medicine,
                as: "medicine",
                attributes: ["medicine_id", "medicine_name"],
              },
            ],
          },
        ],
      },
    ],
    order: [["invoice_id", "DESC"]],
  });
}

async function getInvoiceById(invoiceId, pharmacyId) {
  return Invoice.findOne({
    where: { invoice_id: invoiceId, pharmacy_id: pharmacyId },
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["customer_id", "customer_name", "phone"],
      },
      {
        model: InvoiceItem,
        as: "items",
        include: [
          {
            model: Inventory,
            as: "inventoryBatch",
            include: [
              {
                model: Medicine,
                as: "medicine",
                attributes: ["medicine_id", "medicine_name"],
              },
            ],
          },
        ],
      },
    ],
  });
}

async function updateInvoice(invoiceId, payload, pharmacyId) {
  const {
    customer_id,
    invoice_no,
    invoice_date,
    items = [],
    payment_method = "Cash",
    payment_status = "Paid",
    gst_percent = 0,
    discount_amount = 0,
    notes,
  } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one invoice item is required.");
  }
  const normalizedItems = items.map((item) => ({ ...item, ...normalizeSale(item) }));

  if (customer_id) {
    const customer = await Customer.findOne({ where: { customer_id, pharmacy_id: pharmacyId } });
    if (!customer) {
      throw new Error("Customer not found.");
    }
  }

  const existingInvoice = await Invoice.findOne({ where: { invoice_id: invoiceId, pharmacy_id: pharmacyId } });
  if (!existingInvoice) {
    throw new Error("Invoice not found.");
  }

  const duplicateInvoice = await Invoice.findOne({
    where: {
      pharmacy_id: pharmacyId,
      invoice_no,
      invoice_id: { [Op.ne]: invoiceId },
    },
  });

  if (duplicateInvoice) {
    throw new Error("Invoice number already exists in your pharmacy.");
  }

  const totals = calculateBillTotals(normalizedItems, gst_percent, discount_amount);
  const transaction = await sequelize.transaction();

  try {
    const priorItems = await InvoiceItem.findAll({
      where: { invoice_id: invoiceId, pharmacy_id: pharmacyId },
      transaction,
    });

    for (const item of priorItems) {
      const batch = await Inventory.findOne({
        where: { stock_id: item.stock_id, pharmacy_id: pharmacyId },
        transaction,
      });
      if (batch) {
        await batch.update({ quantity: Number(batch.quantity || 0) + Number(item.quantity || 0) }, { transaction });
      }
    }

    await InvoiceItem.destroy({ where: { invoice_id: invoiceId, pharmacy_id: pharmacyId }, transaction });

    await existingInvoice.update(
      {
        customer_id: customer_id || null,
        invoice_no,
        invoice_date: invoice_date || existingInvoice.invoice_date,
        total_amount: totals.totalAmount,
        discount_amount: totals.discountAmount,
        gst_amount: totals.gstAmount,
        payment_method,
        payment_status,
        notes,
      },
      { transaction }
    );

    const savedItems = [];

    for (const item of normalizedItems) {
      const medicineId = item.medicine_id;
      const requestedQty = item.quantity;
      if (!medicineId || requestedQty <= 0) {
        throw new Error("Each invoice item requires medicine_id and a positive quantity.");
      }

      const medicine = await Medicine.findByPk(medicineId, { transaction });
      if (!medicine) {
        throw new Error(`Medicine ${medicineId} not found.`);
      }

      let availableBatches = await Inventory.findAll({
        where: {
          medicine_id: medicineId,
          pharmacy_id: pharmacyId,
          is_active: true,
          quantity: { [Op.gt]: 0 },
        },
        order: [["expiry_date", "ASC"]],
        transaction,
      });
      const sale = { ...item, medicine_id: medicineId };
      if (sale.usesPacks) {
        availableBatches = availableBatches.filter((batch) => Number(batch.units_per_pack || 1) === sale.units_per_pack);
      }

      if (availableBatches.length === 0) {
        throw new Error(`No available stock for medicine ${medicineId}.`);
      }

      const allocations = allocateBatchesForSale(sale, availableBatches);
      const invoiceItemPayloads = [];

      for (const allocation of allocations) {
        const batch = allocation.batch;
        const quantityFromBatch = allocation.quantity;
        const unitPrice = Number(item.unit_price || batch.selling_price || 0);
        const totalPrice = Number((quantityFromBatch * unitPrice).toFixed(2));

        await batch.update({ quantity: Number(batch.quantity || 0) - quantityFromBatch }, { transaction });

        invoiceItemPayloads.push({
          invoice_id: invoiceId,
          stock_id: batch.stock_id,
          pharmacy_id: pharmacyId,
          quantity: quantityFromBatch,
          pack_quantity: allocation.pack_quantity,
          loose_quantity: allocation.loose_quantity,
          units_per_pack: sale.units_per_pack,
          unit_price: unitPrice,
          total_price: totalPrice,
          is_narcotic: Boolean(medicine?.is_narcotic ?? item.is_narcotic ?? false),
          is_schedule_h1: Boolean(medicine?.is_schedule_h1 ?? item.is_schedule_h1 ?? false),
        });
      }

      const createdItems = await InvoiceItem.bulkCreate(invoiceItemPayloads, { transaction });
      savedItems.push(...createdItems);
    }

    await transaction.commit();

    return {
      invoice: await getInvoiceById(invoiceId, pharmacyId),
      items: savedItems,
      totals,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  calculateBillTotals,
  allocateBatchesForInvoice,
  normalizeSale,
  allocateBatchesForSale,
  createInvoice,
  listInvoices,
  getInvoiceById,
  updateInvoice,
};
