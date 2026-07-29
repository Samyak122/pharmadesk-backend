const { Op } = require("sequelize");
const sequelize = require("../config/database");
const Invoice = require("../models/Invoice");
const InvoiceItem = require("../models/InvoiceItem");
const Inventory = require("../models/Inventory");
const Medicine = require("../models/Medicine");
const Customer = require("../models/Customer");

function calculateBillTotals(items = [], gstPercent = 0) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
  const discountAmount = Number(items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0) || 0);
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

  const totals = calculateBillTotals(items, gst_percent);
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

    for (const item of items) {
      const medicineId = item.medicine_id;
      const requestedQty = Number(item.quantity || 0);
      if (!medicineId || requestedQty <= 0) {
        throw new Error("Each invoice item requires medicine_id and a positive quantity.");
      }

      const medicine = await Medicine.findByPk(medicineId, { transaction });
      if (!medicine) {
        throw new Error(`Medicine ${medicineId} not found.`);
      }

      const availableBatches = await Inventory.findAll({
        where: {
          medicine_id: medicineId,
          pharmacy_id: pharmacyId,
          is_active: true,
          quantity: { [Op.gt]: 0 },
        },
        order: [["expiry_date", "ASC"]],
        transaction,
      });

      if (availableBatches.length === 0) {
        throw new Error(`No available stock for medicine ${medicineId}.`);
      }

      let remainingQty = requestedQty;
      const invoiceItemPayloads = [];

      for (const batch of availableBatches) {
        if (remainingQty <= 0) {
          break;
        }

        const availableQty = Number(batch.quantity || 0);
        if (availableQty <= 0) {
          continue;
        }

        const quantityFromBatch = Math.min(availableQty, remainingQty);
        const unitPrice = Number(item.unit_price || batch.selling_price || 0);
        const totalPrice = Number((quantityFromBatch * unitPrice).toFixed(2));

        await batch.update({ quantity: availableQty - quantityFromBatch }, { transaction });

        invoiceItemPayloads.push({
          invoice_id: invoice.invoice_id,
          stock_id: batch.stock_id,
          pharmacy_id: pharmacyId,
          quantity: quantityFromBatch,
          unit_price: unitPrice,
          total_price: totalPrice,
        });

        remainingQty -= quantityFromBatch;
      }

      if (remainingQty > 0) {
        throw new Error(`Insufficient stock for medicine ${medicineId}.`);
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

module.exports = {
  calculateBillTotals,
  createInvoice,
  listInvoices,
  getInvoiceById,
};
