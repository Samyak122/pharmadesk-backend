const dashboardService = require("../services/dashboardService");

exports.getDashboardSummary = async (req, res) => {
  try {
    const summary = await dashboardService.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getSalesChart = async (req, res) => {
  try {
    const chart = await dashboardService.getSalesChart();
    res.json(chart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
