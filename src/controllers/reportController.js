const reportService = require("../services/reportService");

exports.getSalesReport = async (req, res) => {
  try {
    const data = await reportService.getSalesReport();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getGstReport = async (req, res) => {
  try {
    const data = await reportService.getGstReport();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getInventoryReport = async (req, res) => {
  try {
    const data = await reportService.getInventoryReport();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getPurchaseReport = async (req, res) => {
  try {
    const data = await reportService.getPurchaseReport();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getCustomerReport = async (req, res) => {
  try {
    const data = await reportService.getCustomerReport();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getSupplierReport = async (req, res) => {
  try {
    const data = await reportService.getSupplierReport();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getBatchReport = async (req, res) => {
  try {
    const data = await reportService.getBatchReport();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
