const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { validate, authRegisterSchema, settingsSchema } = require('../src/utils/validation');
const { signToken } = require('../src/services/authService');

test('rejects lowercase or unsupported roles for registration', () => {
  const invalidPayload = { username: 'newuser', password: 'password123', role: 'admin' };
  const { error } = authRegisterSchema.validate(invalidPayload);
  assert.ok(error, 'expected validation to fail for lowercase role');
});

test('accepts only Admin and Pharmacist roles', () => {
  const validAdmin = authRegisterSchema.validate({ username: 'adminuser', password: 'password123', role: 'Admin' });
  const validPharmacist = authRegisterSchema.validate({ username: 'pharmuser', password: 'password123', role: 'Pharmacist' });

  assert.equal(validAdmin.error, undefined);
  assert.equal(validPharmacist.error, undefined);
});

test('validate middleware returns 400 for unsupported roles', () => {
  const req = { body: { username: 'userx', password: 'password123', role: 'staff' } };
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  const next = () => {
    throw new Error('next should not be called');
  };

  validate(authRegisterSchema)(req, res, next);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, 'Validation failed');
});

test('signToken includes tenant and role claims', () => {
  const token = signToken({ user_id: 7, pharmacy_id: 3, role: 'Admin', username: 'alice' });
  const payload = jwt.decode(token);

  assert.equal(payload.user_id, 7);
  assert.equal(payload.pharmacy_id, 3);
  assert.equal(payload.role, 'Admin');
  assert.equal(payload.username, 'alice');
});

test('accepts optional pharmacist license details in settings payloads', () => {
  const { error } = settingsSchema.validate({
    license_number: 'DL-2025-001',
    license_expiry_date: '2026-12-31',
    show_drug_classification: true,
  });

  assert.equal(error, undefined);
});
