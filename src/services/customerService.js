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

async function createCustomer(payload, pharmacyId) {
  if (payload.phone) {
    const existingPhone = await Customer.findOne({
      where: { pharmacy_id: pharmacyId, phone: payload.phone },
    });

    if (existingPhone) {
      throw new Error("Customer with this phone number already exists in your pharmacy.");
    }
  }

  if (payload.email) {
    const existingEmail = await Customer.findOne({
      where: { pharmacy_id: pharmacyId, email: payload.email },
    });

    if (existingEmail) {
      throw new Error("Customer with this email already exists in your pharmacy.");
    }
  }

  return Customer.create({
    ...payload,
    email: payload.email || null,
    address: payload.address || null,
    pharmacy_id: pharmacyId,
  });
}

async function listCustomers(search = "", pharmacyId) {
  const where = { is_active: true, pharmacy_id: pharmacyId };
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

async function getCustomerById(customerId, pharmacyId) {
  return Customer.findOne({ where: { customer_id: customerId, pharmacy_id: pharmacyId } });
}

async function updateCustomer(customerId, payload, pharmacyId) {
  const customer = await Customer.findOne({ where: { customer_id: customerId, pharmacy_id: pharmacyId } });
  if (!customer) {
    return null;
  }

  if (payload.phone && payload.phone !== customer.phone) {
    const duplicatePhone = await Customer.findOne({
      where: { pharmacy_id: pharmacyId, phone: payload.phone, customer_id: { [Op.ne]: customerId } },
    });

    if (duplicatePhone) {
      throw new Error("Customer with this phone number already exists in your pharmacy.");
    }
  }

  if (payload.email && payload.email !== customer.email) {
    const duplicateEmail = await Customer.findOne({
      where: { pharmacy_id: pharmacyId, email: payload.email, customer_id: { [Op.ne]: customerId } },
    });

    if (duplicateEmail) {
      throw new Error("Customer with this email already exists in your pharmacy.");
    }
  }

  await customer.update(payload);
  return customer;
}

async function deleteCustomer(customerId, pharmacyId) {
  const customer = await Customer.findOne({ where: { customer_id: customerId, pharmacy_id: pharmacyId } });
  if (!customer) {
    return null;
  }

  await customer.update({ is_active: false });
  return true;
}

async function searchByPhone(phone, pharmacyId) {
  return Customer.findAll({
    where: {
      phone: { [Op.iLike]: `%${phone}%` },
      is_active: true,
      pharmacy_id: pharmacyId,
    },
  });
}

async function getCustomerHistory(customerId, pharmacyId) {
  const customer = await Customer.findOne({ where: { customer_id: customerId, pharmacy_id: pharmacyId } });
  if (!customer) {
    return null;
  }

  const invoices = await Invoice.findAll({
    where: { customer_id: customerId, pharmacy_id: pharmacyId },
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
