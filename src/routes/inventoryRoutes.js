const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { validate, inventorySchema, inventoryUpdateSchema } = require("../utils/validation");

router.post("/", validate(inventorySchema), inventoryController.createInventory);
router.get("/", inventoryController.getInventory);
router.get("/search", inventoryController.searchStock);
router.get("/fefo", inventoryController.getFefoBatches);
router.put("/:stock_id", validate(inventoryUpdateSchema), inventoryController.updateInventory);
router.delete("/:stock_id", inventoryController.deleteInventory);

module.exports = router;
