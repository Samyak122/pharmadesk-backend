const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");
const { validate, purchaseSchema } = require("../utils/validation");

router.post("/", validate(purchaseSchema), purchaseController.createPurchase);
router.get("/", purchaseController.listPurchases);
router.get("/:purchase_id", purchaseController.getPurchaseById);

module.exports = router;
