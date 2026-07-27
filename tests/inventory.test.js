const assert = require('assert');
const inventoryService = require('../src/services/inventoryService');

(async () => {
  const stock = {
    batch_no: 'BATCH-001',
    expiry_date: '2026-12-31',
    quantity: 10,
    unit_cost: 10,
    selling_price: 15,
  };

  const result = inventoryService.calculateBatchMetrics(stock);
  assert.strictEqual(result.availableQuantity, 10);
  assert.strictEqual(result.reorderPoint, 5);
  assert.strictEqual(result.isLowStock, false);
  console.log('inventory service test passed');
})();
