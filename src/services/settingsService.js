const PharmacySetting = require("../models/PharmacySetting");

async function getSettings(pharmacyId) {
  let settings = await PharmacySetting.findOne({ where: { pharmacy_id: pharmacyId } });
  if (!settings) {
    settings = await PharmacySetting.create({
      pharmacy_id: pharmacyId,
      pharmacy_name: "PharmaDesk",
      owner_name: "Pharmacy Owner",
      currency: "INR",
      timezone: "Asia/Kolkata",
    });
  }
  return settings;
}

async function updateSettings(payload, pharmacyId) {
  const existing = await PharmacySetting.findOne({ where: { pharmacy_id: pharmacyId } });
  if (!existing) {
    return PharmacySetting.create({ ...payload, pharmacy_id: pharmacyId });
  }

  await existing.update(payload);
  return existing;
}

module.exports = {
  getSettings,
  updateSettings,
};
