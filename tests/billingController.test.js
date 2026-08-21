const assert = require('assert');
const billingController = require('../src/controllers/billingController');
const billingService = require('../src/services/billingService');

(async () => {
  const originalCreateInvoice = billingService.createInvoice;
  billingService.createInvoice = async () => ({
    invoice: { invoice_id: 1, discount_amount: 6, total_amount: 9, pharmacy_id: 1 },
    totals: { subtotal: 15, discountAmount: 6, gstAmount: 0, totalAmount: 9 },
  });

  let responseBody;
  try {
    await billingController.createInvoice(
      { body: {}, user: { pharmacy_id: 1 } },
      {
        status: () => ({ json: (body) => { responseBody = body; } }),
      }
    );
  } finally {
    billingService.createInvoice = originalCreateInvoice;
  }

  assert.strictEqual(responseBody.data.invoice.discount_amount, 6);
  assert.strictEqual(responseBody.data.invoice.total_amount, 9);
  assert.strictEqual(responseBody.data.totals.totalAmount, 9);
  console.log('billing controller discount response test passed');
})();