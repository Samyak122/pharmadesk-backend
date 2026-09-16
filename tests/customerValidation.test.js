const assert = require('node:assert/strict');
const test = require('node:test');
const { customerSchema } = require('../src/utils/validation');
const Customer = require('../src/models/Customer');
const customerService = require('../src/services/customerService');

test('accepts a customer with only name and phone', () => {
  const { error } = customerSchema.validate({
    customer_name: 'Rahul Sharma',
    phone: '9876543210',
  });

  assert.equal(error, undefined);
});

test('accepts optional email and address when provided', () => {
  const { error } = customerSchema.validate({
    customer_name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul@gmail.com',
    address: 'Pune',
  });

  assert.equal(error, undefined);
});

test('accepts empty optional email and address', () => {
  const { error } = customerSchema.validate({
    customer_name: 'Rahul Sharma',
    phone: '9876543210',
    email: '',
    address: '',
  });

  assert.equal(error, undefined);
});

test('accepts optional date_of_birth value', () => {
  const { error } = customerSchema.validate({
    customer_name: 'Rahul Sharma',
    phone: '9876543210',
    date_of_birth: '2000-05-15',
  });

  assert.equal(error, undefined);
});

test('rejects missing customer name or phone', () => {
  assert.ok(customerSchema.validate({ phone: '9876543210' }).error);
  assert.ok(customerSchema.validate({ customer_name: 'Rahul Sharma' }).error);
});

test('creates customers with and without optional contact details', async () => {
  const originalFindOne = Customer.findOne;
  const originalCreate = Customer.create;
  const createdPayloads = [];

  Customer.findOne = async () => null;
  Customer.create = async (payload) => {
    createdPayloads.push(payload);
    return payload;
  };

  try {
    await customerService.createCustomer({ customer_name: 'Rahul Sharma', phone: '9876543210' }, 1);
    await customerService.createCustomer({
      customer_name: 'Asha Mehta',
      phone: '9876543211',
      email: 'asha@gmail.com',
      address: 'Pune',
    }, 1);
  } finally {
    Customer.findOne = originalFindOne;
    Customer.create = originalCreate;
  }

  assert.equal(createdPayloads[0].email, null);
  assert.equal(createdPayloads[0].address, null);
  assert.equal(createdPayloads[1].email, 'asha@gmail.com');
  assert.equal(createdPayloads[1].address, 'Pune');
  assert.equal(createdPayloads[0].pharmacy_id, 1);
  assert.equal(createdPayloads[1].pharmacy_id, 1);
});