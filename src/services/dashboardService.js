const { Op } = require("sequelize");
const Invoice = require("../models/Invoice");
const InvoiceItem = require("../models/InvoiceItem");
const Inventory = require("../models/Inventory");
const Medicine = require("../models/Medicine");
const PharmacySetting = require("../models/PharmacySetting");
const { formatDateOnly } = require("../utils/dateUtils");

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateKeyInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDateRanges(timeZone = "Asia/Kolkata") {
  const today = dateKeyInTimeZone(new Date(), timeZone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return {
    today: { start: today, end: addDays(today, 1) },
    month: { start: monthStart, end: nextMonth.toISOString().slice(0, 10) },
  };
}

function calculateFinancials(invoices = []) {
  const sales = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
  const gst = invoices.reduce((sum, invoice) => sum + Number(invoice.gst_amount || 0), 0);
  const cost = invoices.reduce((sum, invoice) => sum + (invoice.items || []).reduce((itemSum, item) => {
    const unitCost = Number(item.inventoryBatch?.unit_cost || 0);
    return itemSum + unitCost * Number(item.quantity || 0);
  }, 0), 0);
  return {
    sales: Number(sales.toFixed(2)),
    cost: Number(cost.toFixed(2)),
    profit: Number((sales - gst - cost).toFixed(2)),
  };
}

async function getDashboardSummary(pharmacyId) {
  const setting = await PharmacySetting.findOne({ where: { pharmacy_id: pharmacyId }, attributes: ["timezone"] });
  const ranges = getDateRanges(setting?.timezone || "Asia/Kolkata");

  const todayInvoices = await Invoice.findAll({
    where: {
      pharmacy_id: pharmacyId,
      invoice_date: {
        [Op.gte]: ranges.today.start,
        [Op.lt]: ranges.today.end,
      },
    },
    include: [{
      model: InvoiceItem,
      as: "items",
      include: [{ model: Inventory, as: "inventoryBatch", attributes: ["stock_id", "unit_cost"] }],
    }],
  });

  const monthlyInvoices = await Invoice.findAll({
    where: {
      pharmacy_id: pharmacyId,
      invoice_date: {
        [Op.gte]: ranges.month.start,
        [Op.lt]: ranges.month.end,
      },
    },
  });

  const todayFinancials = calculateFinancials(todayInvoices);
  const todaySales = todayFinancials.sales;
  const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);

  const lowStockBatches = await Inventory.findAll({
    where: {
      pharmacy_id: pharmacyId,
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
      pharmacy_id: pharmacyId,
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
      pharmacy_id: pharmacyId,
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
      pharmacy_id: pharmacyId,
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
      pharmacy_id: pharmacyId,
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
    where: { pharmacy_id: pharmacyId },
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
    todayProfit: todayFinancials.profit,
    monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
    lowStockMedicines: lowStockBatches.length,
    outOfStockMedicines: outOfStock.length,
    expiringInSevenDays: expiringInSevenDays.length,
    expiringInThirtyDays: expiringInThirtyDays.length,
    expiredMedicines: expiredMedicines.length,
    topSellingMedicines,
  };
}

async function getSalesChart(pharmacyId) {
  const invoices = await Invoice.findAll({
    where: { pharmacy_id: pharmacyId },
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
  calculateFinancials,
  getDateRanges,
};
