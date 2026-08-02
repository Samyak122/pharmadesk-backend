const assert = require('assert');
const billingService = require('../src/services/billingService');

(async () => {
  const batches = [
    { stock_id: 1, quantity: 4, expiry_date: '2025-01-01' },
    { stock_id: 2, quantity: 6, expiry_date: '2025-02-01' },
  ];

  const allocations = billingService.allocateBatchesForInvoice({ medicine_id: 10, quantity: 8 }, batches);
  assert.deepStrictEqual(allocations, [
    { batch: { stock_id: 1, quantity: 4, expiry_date: '2025-01-01' }, quantity: 4 },
    { batch: { stock_id: 2, quantity: 6, expiry_date: '2025-02-01' }, quantity: 4 },
  ]);

  console.log('billing service stock allocation test passed');
})();
