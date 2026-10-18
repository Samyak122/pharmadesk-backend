const express = require("express");
const router = express.Router();

const medicineController = require("../controllers/medicineController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");
const { validate, createMedicineSchema, medicineClassificationSchema } = require("../utils/validation");

router.get("/search", medicineController.searchMedicine);
router.post("/", authenticateToken, validate(createMedicineSchema), medicineController.createMedicine);
router.put(
  "/:medicine_id/classification",
  authenticateToken,
  authorizeRoles("Admin", "Pharmacist"),
  validate(medicineClassificationSchema),
  medicineController.updateClassification
);

module.exports = router;