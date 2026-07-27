const assert = require('assert');
const customerService = require('../src/services/customerService');

const summary = customerService.calculateCustomerStats([
  { total_amount: 100, medicine_name: 'Dolo' },
  { total_amount: 200, medicine_name: 'Dolo' },
  { total_amount: 50, medicine_name: 'Paracetamol' },
]);

assert.strictEqual(summary.totalPurchases, 3);
assert.strictEqual(summary.totalSpent, 350);
assert.strictEqual(summary.topMedicines[0].medicine_name, 'Dolo');
console.log('customer service test passed');
