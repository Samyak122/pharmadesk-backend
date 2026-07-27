const test = require('node:test');
const assert = require('node:assert/strict');
const { settingsSchema } = require('../src/utils/validation');

test('settings schema accepts pharmacy profile fields', () => {
  const { error, value } = settingsSchema.validate({
    pharmacy_name: 'PharmaCare',
    owner_name: 'Dr. Shah',
    gstin: '29ABCDE1234F1Z5',
    drug_license_number: 'DL-001',
    address_line_1: '12 Main Street',
    city: 'Bengaluru',
    state: 'Karnataka',
    pin_code: '560001',
    phone_number: '9876543210',
    email: 'care@pharmacare.com',
    website: 'https://pharmacare.example',
    invoice_footer: 'Thank you for choosing PharmaCare',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  });

  assert.equal(error, undefined);
  assert.equal(value.pharmacy_name, 'PharmaCare');
});
