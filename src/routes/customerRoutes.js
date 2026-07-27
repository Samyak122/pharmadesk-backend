const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const { validate, customerSchema } = require("../utils/validation");

router.post("/", validate(customerSchema), customerController.createCustomer);
router.get("/", customerController.listCustomers);
router.get("/search", customerController.searchByPhone);
router.get("/:customer_id/history", customerController.getCustomerHistory);
router.get("/:customer_id", customerController.getCustomerById);
router.put("/:customer_id", validate(customerSchema), customerController.updateCustomer);
router.delete("/:customer_id", customerController.deleteCustomer);

module.exports = router;
