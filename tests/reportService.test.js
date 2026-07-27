const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSalesRows } = require('../src/services/reportService');

test('buildSalesRows flattens invoice items into detailed sales rows', () => {
  const invoices = [
    {
      invoice_id: 1,
      invoice_no: 'INV-1001',
      invoice_date: '2026-07-22',
      total_amount: 120,
      gst_amount: 20,
      payment_status: 'Paid',
      customer: { customer_name: 'Alice', phone: '9999999999' },
      items: [
        {
          quantity: 2,
          unit_price: 50,
          total_price: 100,
          inventoryBatch: {
            batch_no: 'B1',
            expiry_date: '2026-12-01',
            medicine: { medicine_name: 'Paracetamol' },
          },
        },
      ],
    },
  ];

  const rows = buildSalesRows(invoices);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].medicine_name, 'Paracetamol');
  assert.equal(rows[0].batch_no, 'B1');
  assert.equal(rows[0].quantity, 2);
  assert.equal(rows[0].invoice_total, 120);
});
