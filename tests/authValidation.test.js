const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, authRegisterSchema } = require('../src/utils/validation');

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
