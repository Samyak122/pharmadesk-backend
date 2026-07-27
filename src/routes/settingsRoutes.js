const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { validate, settingsSchema } = require("../utils/validation");

router.get("/", settingsController.getSettings);
router.put("/", validate(settingsSchema), settingsController.updateSettings);

module.exports = router;
