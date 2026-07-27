const { Op } = require("sequelize");
const Customer = require("../models/Customer");
const Invoice = require("../models/Invoice");
const InvoiceItem = require("../models/InvoiceItem");
const Inventory = require("../models/Inventory");
const Medicine = require("../models/Medicine");

function calculateCustomerStats(history = []) {
  const totalPurchases = history.length;
  const totalSpent = history.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

  const medicineMap = new Map();
  history.forEach((entry) => {
    const key = entry.medicine_name || "Unknown";
    const current = medicineMap.get(key) || { medicine_name: key, count: 0 };
    current.count += 1;
    medicineMap.set(key, current);
  });

  const topMedicines = Array.from(medicineMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalPurchases,
    totalSpent: Number(totalSpent.toFixed(2)),
    topMedicines,
  };
}

async function createCustomer(payload) {
  return Customer.create(payload);
}

async function listCustomers(search = "") {
  const where = { is_active: true };
  if (search) {
    where[Op.or] = [
      { customer_name: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ];
  }

  return Customer.findAll({
    where,
    order: [["customer_name", "ASC"]],
  });
}

async function getCustomerById(customerId) {
  return Customer.findByPk(customerId);
}

async function updateCustomer(customerId, payload) {
  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    return null;
  }

  await customer.update(payload);
  return customer;
}

async function deleteCustomer(customerId) {
  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    return null;
  }

  await customer.update({ is_active: false });
  return true;
}

async function searchByPhone(phone) {
  return Customer.findAll({
    where: {
      phone: { [Op.iLike]: `%${phone}%` },
      is_active: true,
    },
  });
}

async function getCustomerHistory(customerId) {
  const customer = await Customer.findByPk(customerId);
  if (!customer) {
    return null;
  }

  const invoices = await Invoice.findAll({
    where: { customer_id: customerId },
    include: [
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

  const history = invoices.flatMap((invoice) =>
    invoice.items.map((item) => ({
      invoice_id: invoice.invoice_id,
      invoice_no: invoice.invoice_no,
      invoice_date: invoice.invoice_date,
      total_amount: invoice.total_amount,
      medicine_name: item.inventoryBatch?.medicine?.medicine_name || "Unknown",
    }))
  );

  const stats = calculateCustomerStats(history);

  return {
    customer,
    invoices,
    history,
    stats,
  };
}

module.exports = {
  calculateCustomerStats,
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  searchByPhone,
  getCustomerHistory,
};
