const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFinancials, getDateRanges } = require('../src/services/dashboardService');

test('calculates sales and profit from sold batch cost', () => {
  const result = calculateFinancials([{ total_amount: 50, gst_amount: 0, items: [{ quantity: 1, inventoryBatch: { unit_cost: 30 } }] }]);
  assert.deepEqual(result, { sales: 50, cost: 30, profit: 20 });
});

test('scales cost by quantity and supports different batch costs', () => {
  const result = calculateFinancials([{ total_amount: 200, gst_amount: 0, items: [
    { quantity: 2, inventoryBatch: { unit_cost: 30 } },
    { quantity: 1, inventoryBatch: { unit_cost: 70 } },
  ] }]);
  assert.deepEqual(result, { sales: 200, cost: 130, profit: 70 });
});

test('discount and GST reduce profit without changing final sales', () => {
  const result = calculateFinancials([{ total_amount: 95, gst_amount: 5, discount_amount: 10, items: [{ quantity: 1, inventoryBatch: { unit_cost: 60 } }] }]);
  assert.deepEqual(result, { sales: 95, cost: 60, profit: 30 });
});

test('date ranges use the configured pharmacy timezone', () => {
  const ranges = getDateRanges('Asia/Kolkata');
  assert.match(ranges.today.start, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(ranges.today.start, ranges.today.end);
  assert.equal(ranges.month.start.slice(0, 7), ranges.today.start.slice(0, 7));
});
