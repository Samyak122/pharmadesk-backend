const { Op } = require("sequelize");
const Inventory = require("../models/Inventory");
const Medicine = require("../models/Medicine");

function calculateBatchMetrics(batch) {
  const quantity = Number(batch?.quantity ?? 0);
  const reorderPoint = Math.max(5, Math.floor(quantity * 0.5));
  const isLowStock = quantity <= reorderPoint;

  const expiryDate = batch?.expiry_date ? new Date(batch.expiry_date) : null;
  const now = new Date();
  const daysToExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    availableQuantity: quantity,
    reorderPoint,
    isLowStock,
    daysToExpiry,
    isExpiringSoon: daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0,
    isExpired: daysToExpiry !== null && daysToExpiry < 0,
  };
}

async function listInventory(filters = {}) {
  const where = {
    is_active: true,
    pharmacy_id: filters.pharmacyId,
    ...(filters.medicine_id ? { medicine_id: filters.medicine_id } : {}),
    ...(filters.lowStock ? { quantity: { [Op.lte]: filters.lowStockThreshold ?? 0 } } : {}),
  };

  if (filters.search) {
    const matchingMedicines = await Medicine.findAll({
      where: {
        medicine_name: {
          [Op.iLike]: `%${filters.search}%`,
        },
      },
      attributes: ["medicine_id"],
      raw: true,
    });

    const medicineIds = matchingMedicines.map((item) => item.medicine_id);

    if (medicineIds.length === 0) {
      return [];
    }

    where.medicine_id = {
      [Op.in]: medicineIds,
    };
  }

  if (filters.expiringSoon) {
    const days = Number(filters.expiringSoon) || 30;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + days);

    where.expiry_date = {
      [Op.lte]: maxDate.toISOString().slice(0, 10),
    };
  }

  if (filters.expired) {
    const today = new Date().toISOString().slice(0, 10);
    where.expiry_date = {
      [Op.lt]: today,
    };
  }

  return Inventory.findAll({
    where,
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name", "manufacturer", "composition"],
      },
    ],
    order: [["expiry_date", "ASC"], ["quantity", "DESC"]],
    raw: false,
  });
}

async function getFefoBatches(medicineId, pharmacyId) {
  return Inventory.findAll({
    where: {
      medicine_id: medicineId,
      pharmacy_id: pharmacyId,
      is_active: true,
      quantity: { [Op.gt]: 0 },
    },
    order: [["expiry_date", "ASC"]],
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name", "manufacturer"],
      },
    ],
  });
}

async function searchStock(query, pharmacyId) {
  if (!query) {
    return [];
  }

  const matchingMedicines = await Medicine.findAll({
    where: {
      medicine_name: {
        [Op.iLike]: `%${query}%`,
      },
    },
    attributes: ["medicine_id", "medicine_name", "manufacturer", "composition"],
    raw: true,
  });

  if (matchingMedicines.length === 0) {
    return [];
  }

  const medicineIds = matchingMedicines.map((item) => item.medicine_id);

  const batches = await Inventory.findAll({
    where: {
      medicine_id: { [Op.in]: medicineIds },
      pharmacy_id: pharmacyId,
      is_active: true,
      quantity: { [Op.gt]: 0 },
    },
    include: [
      {
        model: Medicine,
        as: "medicine",
        attributes: ["medicine_id", "medicine_name", "manufacturer", "composition"],
      },
    ],
    order: [["expiry_date", "ASC"], ["quantity", "DESC"]],
  });

  return batches.map((batch) => ({
    stock_id: batch.stock_id,
    medicine_id: batch.medicine_id,
    medicine_name: batch.medicine?.medicine_name,
    manufacturer: batch.medicine?.manufacturer,
    composition: batch.medicine?.composition,
    batch_no: batch.batch_no,
    expiry_date: batch.expiry_date,
    quantity: batch.quantity,
    selling_price: batch.selling_price,
    location: batch.location,
  }));
}

async function createInventory(payload, pharmacyId) {
  const existingBatch = await Inventory.findOne({
    where: { pharmacy_id: pharmacyId, batch_no: payload.batch_no },
  });

  if (existingBatch) {
    throw new Error("Inventory batch with this batch number already exists in your pharmacy.");
  }

  return Inventory.create({ ...payload, pharmacy_id: pharmacyId });
}

async function updateInventory(stockId, payload, pharmacyId) {
  const batch = await Inventory.findOne({
    where: { stock_id: stockId, pharmacy_id: pharmacyId, is_active: true },
  });

  if (!batch) {
    return null;
  }

  if (payload.batch_no && payload.batch_no !== batch.batch_no) {
    const duplicateBatch = await Inventory.findOne({
      where: { pharmacy_id: pharmacyId, batch_no: payload.batch_no, stock_id: { [Op.ne]: stockId } },
    });

    if (duplicateBatch) {
      throw new Error("Inventory batch with this batch number already exists in your pharmacy.");
    }
  }

  await batch.update(payload);
  return batch;
}

async function deleteInventory(stockId, pharmacyId) {
  const batch = await Inventory.findOne({
    where: { stock_id: stockId, pharmacy_id: pharmacyId, is_active: true },
  });

  if (!batch) {
    return null;
  }

  await batch.update({ is_active: false });
  return true;
}

module.exports = {
  calculateBatchMetrics,
  listInventory,
  getFefoBatches,
  searchStock,
  createInventory,
  updateInventory,
  deleteInventory,
};
