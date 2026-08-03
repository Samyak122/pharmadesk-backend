const express = require("express");
const router = express.Router();

const contacts = [];

router.post("/", (req, res) => {
  const {
    pharmacyName,
    ownerName,
    phone,
    email,
    gst,
    license,
    city,
    state,
    currentSoftware,
    message,
  } = req.body || {};

  if (!pharmacyName || !ownerName || !phone || !email || !city || !state || !message) {
    return res.status(400).json({ message: "Please provide the required contact details." });
  }

  const contact = {
    id: contacts.length + 1,
    pharmacyName,
    ownerName,
    phone,
    email,
    gst: gst || null,
    license: license || null,
    city,
    state,
    currentSoftware: currentSoftware || null,
    message,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };

  contacts.push(contact);

  return res.status(201).json({ message: "Contact request received successfully.", data: contact });
});

module.exports = router;
