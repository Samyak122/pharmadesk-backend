const assert = require('assert');
const purchaseService = require('../src/services/purchaseService');

const summary = purchaseService.calculatePurchaseSummary([
  { quantity: 10, unit_cost: 100 },
  { quantity: 5, unit_cost: 80 },
]);

assert.strictEqual(summary.totalQuantity, 15);
assert.strictEqual(summary.totalCost, 1400);
assert.strictEqual(summary.averageUnitCost, 93.33);
console.log('purchase service test passed');
