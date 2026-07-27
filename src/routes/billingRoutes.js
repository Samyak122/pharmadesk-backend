const express = require("express");
const router = express.Router();
const billingController = require("../controllers/billingController");
const { validate, billingSchema } = require("../utils/validation");

router.post("/", validate(billingSchema), billingController.createInvoice);
router.get("/", billingController.listInvoices);
router.get("/:invoice_id", billingController.getInvoiceById);

module.exports = router;
