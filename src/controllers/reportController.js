const reportService = require("../services/reportService");

exports.getSalesReport = async (req, res) => {
  try {
    const data = await reportService.getSalesReport(req.user?.pharmacy_id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getGstReport = async (req, res) => {
  try {
    const data = await reportService.getGstReport(req.user?.pharmacy_id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getInventoryReport = async (req, res) => {
  try {
    const data = await reportService.getInventoryReport(req.user?.pharmacy_id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getPurchaseReport = async (req, res) => {
  try {
    const data = await reportService.getPurchaseReport(req.user?.pharmacy_id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getCustomerReport = async (req, res) => {
  try {
    const data = await reportService.getCustomerReport(req.user?.pharmacy_id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getSupplierReport = async (req, res) => {
  try {
    const data = await reportService.getSupplierReport(req.user?.pharmacy_id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getBatchReport = async (req, res) => {
  try {
    const data = await reportService.getBatchReport(req.user?.pharmacy_id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
