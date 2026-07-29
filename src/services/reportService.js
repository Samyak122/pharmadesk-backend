const { Op } = require("sequelize");
const Invoice = require("../models/Invoice");
const InvoiceItem = require("../models/InvoiceItem");
const Inventory = require("../models/Inventory");
const Purchase = require("../models/Purchase");
const PurchaseItem = require("../models/PurchaseItem");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const Medicine = require("../models/Medicine");

function calculateInvoiceGstPercent(invoice) {
  const totalAmount = Number(invoice.total_amount || 0);
  const gstAmount = Number(invoice.gst_amount || 0);
  const taxableAmount = Math.max(0, totalAmount - gstAmount);
  if (taxableAmount <= 0) {
    return 0;
  }

  return Number(((gstAmount / taxableAmount) * 100).toFixed(2));
}

function buildSalesRows(invoices = []) {
  return invoices.flatMap((invoice) => {
    const gstPercent = calculateInvoiceGstPercent(invoice);

    return (invoice.items || []).map((item) => {
      const lineSubtotal = Number(item.total_price ?? Number(item.quantity || 0) * Number(item.unit_price || 0));
      const lineGstAmount = Number(((lineSubtotal * gstPercent) / 100).toFixed(2));
      const lineTotal = Number((lineSubtotal + lineGstAmount).toFixed(2));

      return {
        invoice_no: invoice.invoice_no,
        invoice_date: invoice.invoice_date,
        customer_name: invoice.customer?.customer_name || "Walk-in",
        customer_phone: invoice.customer?.phone || "",
        medicine_name: item.inventoryBatch?.medicine?.medicine_name || item.medicine_name || "Unknown",
        batch_no: item.inventoryBatch?.batch_no || item.batch_no || "",
        expiry_date: item.inventoryBatch?.expiry_date || item.expiry_date || "",
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        gst_percent: gstPercent,
        gst_amount: lineGstAmount,
        line_total: lineTotal,
        invoice_total: Number(invoice.total_amount || 0),
        payment_status: invoice.payment_status,
      };
    });
  });
}

async function getSalesReport(pharmacyId) {
  const invoices = await Invoice.findAll({
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
    order: [["invoice_date", "ASC"]],
  });

  return buildSalesRows(invoices);
}

async function getGstReport(pharmacyId) {
  const invoices = await Invoice.findAll({
    where: { pharmacy_id: pharmacyId },
    attributes: ["invoice_no", "invoice_date", "total_amount", "gst_amount", "discount_amount"],
    order: [["invoice_date", "ASC"]],
  });

  return invoices.map((invoice) => ({
    invoice_no: invoice.invoice_no,
    invoice_date: invoice.invoice_date,
    taxable_amount: Number((Number(invoice.total_amount || 0) - Number(invoice.discount_amount || 0)).toFixed(2)),
    gst_amount: Number(invoice.gst_amount || 0),
    total_amount: Number(invoice.total_amount || 0),
  }));
}

async function getInventoryReport(pharmacyId) {
  const batches = await Inventory.findAll({
    where: { pharmacy_id: pharmacyId, is_active: true },
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name", "manufacturer"],
      },
    ],
    order: [["expiry_date", "ASC"]],
  });

  return batches.map((batch) => ({
    stock_id: batch.stock_id,
    medicine_name: batch.medicine?.medicine_name || "Unknown",
    batch_no: batch.batch_no,
    expiry_date: batch.expiry_date,
    quantity: batch.quantity,
    selling_price: batch.selling_price,
    unit_cost: batch.unit_cost,
    location: batch.location,
  }));
}

async function getPurchaseReport(pharmacyId) {
  const purchases = await Purchase.findAll({
    where: { pharmacy_id: pharmacyId },
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["supplier_id", "supplier_name"],
      },
    ],
    order: [["purchase_date", "ASC"]],
  });

  return purchases.map((purchase) => ({
    purchase_id: purchase.purchase_id,
    purchase_date: purchase.purchase_date,
    invoice_no: purchase.invoice_no,
    supplier_name: purchase.supplier?.supplier_name || "Unknown",
    total_amount: Number(purchase.total_amount || 0),
    payment_status: purchase.payment_status,
  }));
}

async function getCustomerReport(pharmacyId) {
  const customers = await Customer.findAll({
    where: { pharmacy_id: pharmacyId, is_active: true },
    order: [["customer_name", "ASC"]],
  });

  return customers.map((customer) => ({
    customer_id: customer.customer_id,
    customer_name: customer.customer_name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
  }));
}

async function getSupplierReport(pharmacyId) {
  const suppliers = await Supplier.findAll({
    where: { pharmacy_id: pharmacyId, is_active: true },
    order: [["supplier_name", "ASC"]],
  });

  return suppliers.map((supplier) => ({
    supplier_id: supplier.supplier_id,
    supplier_name: supplier.supplier_name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    gst_number: supplier.gst_number,
  }));
}

async function getBatchReport(pharmacyId) {
  const batches = await Inventory.findAll({
    where: { pharmacy_id: pharmacyId, is_active: true },
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name"],
      },
    ],
    order: [["batch_no", "ASC"]],
  });

  return batches.map((batch) => ({
    batch_no: batch.batch_no,
    medicine_name: batch.medicine?.medicine_name || "Unknown",
    expiry_date: batch.expiry_date,
    quantity: batch.quantity,
    location: batch.location,
  }));
}

module.exports = {
  buildSalesRows,
  getSalesReport,
  getGstReport,
  getInventoryReport,
  getPurchaseReport,
  getCustomerReport,
  getSupplierReport,
  getBatchReport,
};
