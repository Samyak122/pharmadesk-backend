const express = require("express");
const router = express.Router();

const medicineController = require("../controllers/medicineController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.get("/search", medicineController.searchMedicine);
router.post("/", authenticateToken, medicineController.createMedicine);

module.exports = router;