const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");

router.get("/sales", reportController.getSalesReport);
router.get("/gst", reportController.getGstReport);
router.get("/inventory", reportController.getInventoryReport);
router.get("/purchases", reportController.getPurchaseReport);
router.get("/customers", reportController.getCustomerReport);
router.get("/suppliers", reportController.getSupplierReport);
router.get("/batches", reportController.getBatchReport);

module.exports = router;
