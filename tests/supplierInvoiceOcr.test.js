const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeInvoiceDate,
  validateGstin,
  sanitizeOcrJson,
  validateOcrExtractionPayload,
  parseOcrJsonContent,
  isOcrResponseTruncated,
} = require('../src/services/openAiOcrService');

const validOcrJson = JSON.stringify({
  supplier: { name: 'Medico Pharma', gstin: null, address: null, phone: null },
  invoice: { number: 'INV-204', date: null },
  items: [{ medicine: 'VITCOFOL', manufacturer: null, hsn: null, pack: null, batch: 'A123', expiry: null, quantity: 1, free: 0, mrp: 100, rate: 80, gst: null, taxable_amount: null, amount: null }],
  totals: { subtotal: null, tax: null, grand_total: null },
});

test('parses valid OCR JSON wrapped in markdown fences', () => {
  assert.deepEqual(parseOcrJsonContent(`\`\`\`json\n${validOcrJson}\n\`\`\``), JSON.parse(validOcrJson));
});

test('parses valid OCR JSON surrounded by explanation', () => {
  assert.deepEqual(parseOcrJsonContent(`Here is the extracted invoice:\n${validOcrJson}\nEnd of extraction.`), JSON.parse(validOcrJson));
});

test('does not repair malformed or truncated OCR JSON', () => {
  assert.throws(() => parseOcrJsonContent(`${validOcrJson.slice(0, -2)}`), SyntaxError);
});

test('identifies a provider response truncated by the output limit', () => {
  assert.equal(isOcrResponseTruncated({ choices: [{ finish_reason: 'length' }] }), true);
  assert.equal(isOcrResponseTruncated({ choices: [{ finish_reason: 'stop' }] }), false);
});

test('valid GSTIN stays intact and invalid GSTIN is nulled', () => {
  assert.equal(validateGstin('27AABCM1234C1Z5'), '27AABCM1234C1Z5');
  assert.equal(validateGstin('12345'), null);
  assert.equal(validateGstin('INVALID-GSTIN'), null);
});

test('common Indian invoice dates are normalized to ISO format', () => {
  assert.equal(normalizeInvoiceDate('15/08/2026'), '2026-08-15');
  assert.equal(normalizeInvoiceDate('15-08-26'), '2026-08-15');
  assert.equal(normalizeInvoiceDate('15.08.2026'), '2026-08-15');
  assert.equal(normalizeInvoiceDate('08/2028'), '2028-08-01');
  assert.equal(normalizeInvoiceDate('unknown'), null);
});

test('strict OCR response schema keeps missing values as null and rejects invalid numeric fields', () => {
  const payload = {
    supplier: { name: 'Medico Pharma', gstin: '27AABCM1234C1Z5', address: 'Pune', phone: '9999999999' },
    invoice: { number: 'INV-204', date: '15/08/2026' },
    items: [
      {
        medicine: 'VITCOFOL ORAL SUSPENSION 20 ML',
        manufacturer: 'Cipla',
        hsn: '3004',
        pack: '20 ML',
        batch: 'A12345',
        expiry: '08/2028',
        quantity: '10',
        free: '2',
        mrp: '1250.50',
        rate: '975.00',
        gst: '5',
        taxable_amount: '9750.00',
        amount: '10237.50',
      },
    ],
    totals: { subtotal: '9750.00', tax: '487.50', grand_total: '10237.50' },
  };

  const sanitized = validateOcrExtractionPayload(payload);
  assert.equal(sanitized.supplier.gstin, '27AABCM1234C1Z5');
  assert.equal(sanitized.invoice.date, '2026-08-15');
  assert.equal(sanitized.items[0].quantity, 10);
  assert.equal(sanitized.items[0].free, 2);
  assert.equal(sanitized.totals.grand_total, 10237.5);
});

test('malformed and partially readable invoice payloads are rejected without zero values', () => {
  const payload = {
    supplier: { name: 'Medico Pharma', gstin: 'bad-gstin', address: null, phone: null },
    invoice: { number: 'INV-204', date: '99/99/9999' },
    items: [
      {
        medicine: 'VITCOFOL',
        manufacturer: null,
        hsn: null,
        pack: null,
        batch: null,
        expiry: null,
        quantity: null,
        free: null,
        mrp: null,
        rate: null,
        gst: null,
        taxable_amount: null,
        amount: null,
      },
    ],
    totals: { subtotal: null, tax: null, grand_total: null },
  };

  const sanitized = validateOcrExtractionPayload(payload);
  assert.equal(sanitized.supplier.gstin, null);
  assert.equal(sanitized.invoice.date, null);
  assert.equal(sanitized.items[0].quantity, null);
  assert.equal(sanitized.items[0].mrp, null);
  assert.equal(sanitized.items[0].free, null);
});

test('sanitizeOcrJson removes unsafe values and preserves null for unknown fields', () => {
  const sanitized = sanitizeOcrJson({
    supplier: { name: '  Medico Pharma  ', gstin: ' 27AABCM1234C1Z5 ', address: '   ', phone: '9999999999' },
    invoice: { number: 'INV-204', date: '2026-08-15' },
    items: [{ medicine: 'VITCOFOL\nSUSPENSION 20 ML', manufacturer: 'Cipla', hsn: '3004', batch: 'ABC123', expiry: '08/2028', quantity: '10', free: '0', mrp: '1,250.50', rate: '975', gst: '5%', amount: '10237.50' }],
    totals: { subtotal: '9750.00', tax: '487.50', grand_total: '10237.50' },
  });

  assert.equal(sanitized.supplier.name, 'Medico Pharma');
  assert.equal(sanitized.items[0].medicine, 'VITCOFOL SUSPENSION 20 ML');
  assert.equal(sanitized.items[0].quantity, 10);
  assert.equal(sanitized.items[0].free, 0);
  assert.equal(sanitized.items[0].mrp, 1250.5);
  assert.equal(sanitized.totals.grand_total, 10237.5);
});

