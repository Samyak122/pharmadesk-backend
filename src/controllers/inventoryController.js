const InventoryService = require("../services/inventoryService");
const Medicine = require("../models/Medicine");

exports.createInventory = async (req, res) => {
  try {
    const {
      medicine_id,
      batch_no,
      expiry_date,
      quantity,
      unit_cost,
      selling_price,
      min_stock,
      location,
    } = req.body;

    if (!medicine_id || !batch_no || !expiry_date || quantity === undefined) {
      return res.status(400).json({
        message: "medicine_id, batch_no, expiry_date, and quantity are required",
      });
    }

    const medicine = await Medicine.findByPk(medicine_id);
    if (!medicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }

    if (Number(quantity) < 0) {
      return res.status(400).json({ message: "quantity cannot be negative" });
    }

    const inventory = await InventoryService.createInventory({
      medicine_id,
      batch_no,
      expiry_date,
      quantity: Number(quantity),
      unit_cost: Number(unit_cost || 0),
      selling_price: Number(selling_price || 0),
      min_stock: Number(min_stock || 5),
      location,
    });

    res.status(201).json({
      message: "Inventory added successfully",
      data: inventory,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getInventory = async (req, res) => {
  try {
    const batches = await InventoryService.listInventory({
      search: req.query.search,
      lowStock: req.query.lowStock === "true",
      lowStockThreshold: req.query.lowStockThreshold ? Number(req.query.lowStockThreshold) : 0,
      expiringSoon: req.query.expiringSoon,
      expired: req.query.expired === "true",
      medicine_id: req.query.medicine_id ? Number(req.query.medicine_id) : null,
    });

    const formatted = batches.map((batch) => ({
      ...batch.toJSON(),
      ...InventoryService.calculateBatchMetrics(batch.toJSON()),
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.updateInventory = async (req, res) => {
  try {
    const { stock_id } = req.params;
    const payload = req.body;

    if (payload.quantity !== undefined && Number(payload.quantity) < 0) {
      return res.status(400).json({ message: "quantity cannot be negative" });
    }

    const updated = await InventoryService.updateInventory(Number(stock_id), payload);
    if (!updated) {
      return res.status(404).json({ message: "Inventory batch not found" });
    }

    res.json({ message: "Inventory updated successfully", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deleteInventory = async (req, res) => {
  try {
    const { stock_id } = req.params;
    const removed = await InventoryService.deleteInventory(Number(stock_id));

    if (!removed) {
      return res.status(404).json({ message: "Inventory batch not found" });
    }

    res.json({ message: "Inventory batch deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getFefoBatches = async (req, res) => {
  try {
    const medicineId = Number(req.query.medicine_id);
    if (!medicineId) {
      return res.status(400).json({ message: "medicine_id is required" });
    }

    const batches = await InventoryService.getFefoBatches(medicineId);
    res.json(batches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.searchStock = async (req, res) => {
  try {
    const query = req.query.q || req.query.search || "";
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const stock = await InventoryService.searchStock(query);
    res.json(stock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
