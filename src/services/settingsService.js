const PharmacySetting = require("../models/PharmacySetting");

async function getSettings() {
  let settings = await PharmacySetting.findOne();
  if (!settings) {
    settings = await PharmacySetting.create({
      pharmacy_name: "PharmaDesk",
      owner_name: "Pharmacy Owner",
      currency: "INR",
      timezone: "Asia/Kolkata",
    });
  }
  return settings;
}

async function updateSettings(payload) {
  const existing = await PharmacySetting.findOne();
  if (!existing) {
    return PharmacySetting.create(payload);
  }

  await existing.update(payload);
  return existing;
}

module.exports = {
  getSettings,
  updateSettings,
};
