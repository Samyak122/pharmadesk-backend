const { Op } = require("sequelize");
const Invoice = require("../models/Invoice");
const InvoiceItem = require("../models/InvoiceItem");
const Inventory = require("../models/Inventory");
const Purchase = require("../models/Purchase");
const PurchaseItem = require("../models/PurchaseItem");
const Medicine = require("../models/Medicine");
const { formatDateOnly } = require("../utils/dateUtils");

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

async function getDashboardSummary() {
  const todayRange = getTodayRange();
  const monthRange = getMonthRange();

  const todayInvoices = await Invoice.findAll({
    where: {
      invoice_date: {
        [Op.gte]: formatDateOnly(todayRange.start),
        [Op.lt]: formatDateOnly(todayRange.end),
      },
    },
  });

  const monthlyInvoices = await Invoice.findAll({
    where: {
      invoice_date: {
        [Op.gte]: formatDateOnly(monthRange.start),
        [Op.lt]: formatDateOnly(monthRange.end),
      },
    },
  });

  const todaySales = todayInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
  const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);

  const purchases = await Purchase.findAll({
    where: {
      purchase_date: {
        [Op.gte]: formatDateOnly(todayRange.start),
        [Op.lt]: formatDateOnly(todayRange.end),
      },
    },
  });

  const todayCost = purchases.reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0);
  const todayProfit = Number((todaySales - todayCost).toFixed(2));

  const lowStockBatches = await Inventory.findAll({
    where: {
      is_active: true,
      quantity: { [Op.lte]: 5 },
    },
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name"],
      },
    ],
    order: [["quantity", "ASC"]],
  });

  const outOfStock = await Inventory.findAll({
    where: {
      is_active: true,
      quantity: { [Op.eq]: 0 },
    },
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name"],
      },
    ],
  });

  const today = new Date();
  const inSevenDays = new Date(today);
  inSevenDays.setDate(today.getDate() + 7);
  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(today.getDate() + 30);

  const expiringInSevenDays = await Inventory.findAll({
    where: {
      is_active: true,
      expiry_date: {
        [Op.gte]: formatDateOnly(today),
        [Op.lte]: formatDateOnly(inSevenDays),
      },
    },
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name"],
      },
    ],
  });

  const expiringInThirtyDays = await Inventory.findAll({
    where: {
      is_active: true,
      expiry_date: {
        [Op.gte]: formatDateOnly(today),
        [Op.lte]: formatDateOnly(inThirtyDays),
      },
    },
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name"],
      },
    ],
  });

  const expiredMedicines = await Inventory.findAll({
    where: {
      is_active: true,
      expiry_date: { [Op.lt]: formatDateOnly(today) },
    },
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name"],
      },
    ],
  });

  const invoiceItems = await InvoiceItem.findAll({
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
  });

  const salesByMedicine = new Map();
  invoiceItems.forEach((item) => {
    const medicineName = item.inventoryBatch?.medicine?.medicine_name || "Unknown";
    const current = salesByMedicine.get(medicineName) || { medicine_name: medicineName, total_qty: 0 };
    current.total_qty += Number(item.quantity || 0);
    salesByMedicine.set(medicineName, current);
  });

  const topSellingMedicines = Array.from(salesByMedicine.values())
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 5);

  return {
    todaySales: Number(todaySales.toFixed(2)),
    todayProfit: Number(todayProfit.toFixed(2)),
    monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
    lowStockMedicines: lowStockBatches.length,
    outOfStockMedicines: outOfStock.length,
    expiringInSevenDays: expiringInSevenDays.length,
    expiringInThirtyDays: expiringInThirtyDays.length,
    expiredMedicines: expiredMedicines.length,
    topSellingMedicines,
  };
}

async function getSalesChart() {
  const invoices = await Invoice.findAll({
    attributes: ["invoice_date", "total_amount"],
    order: [["invoice_date", "ASC"]],
  });

  return invoices.map((invoice) => ({
    date: invoice.invoice_date,
    sales: Number(invoice.total_amount || 0),
  }));
}

module.exports = {
  getDashboardSummary,
  getSalesChart,
};
