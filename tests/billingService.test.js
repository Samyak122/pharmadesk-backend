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

  assert.deepStrictEqual(billingService.calculateBillTotals([
    { quantity: 1, unit_price: 15 },
  ], 0), {
    subtotal: 15,
    discountAmount: 0,
    taxableAmount: 15,
    gstAmount: 0,
    totalAmount: 15,
  });

  assert.deepStrictEqual(billingService.calculateBillTotals([
    { quantity: 1, unit_price: 15 },
  ], 0, 6), {
    subtotal: 15,
    discountAmount: 6,
    taxableAmount: 9,
    gstAmount: 0,
    totalAmount: 9,
  });

  console.log('billing service totals and stock allocation tests passed');
})();
