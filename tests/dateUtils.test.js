const test = require('node:test');
const assert = require('node:assert/strict');
const { formatDateOnly } = require('../src/utils/dateUtils');

test('formatDateOnly returns the local calendar date without converting to UTC', () => {
  const date = new Date(2024, 0, 2, 23, 30, 0);
  assert.equal(formatDateOnly(date), '2024-01-02');
});
