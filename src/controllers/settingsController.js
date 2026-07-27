const settingsService = require("../services/settingsService");

exports.getSettings = async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await settingsService.updateSettings(req.body);
    res.json({ message: "Settings updated successfully", data: settings });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "Server Error" });
  }
};
