const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

router.get("/summary", dashboardController.getDashboardSummary);
router.get("/sales-chart", dashboardController.getSalesChart);

module.exports = router;
