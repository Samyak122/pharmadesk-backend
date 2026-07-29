const assert = require('assert');
const customerService = require('../src/services/customerService');
const Customer = require('../src/models/Customer');

(async () => {
  const originalFindOne = Customer.findOne;
  const originalCreate = Customer.create;

  try {
    Customer.findOne = async (options) => {
      assert.deepStrictEqual(options.where, { pharmacy_id: 42, phone: '123456' });
      return { customer_id: 1 };
    };

    await assert.rejects(
      () => customerService.createCustomer({ phone: '123456' }, 42),
      /already exists/
    );

    Customer.findOne = async () => null;
    Customer.create = async (payload) => payload;

    const created = await customerService.createCustomer({ phone: '654321' }, 42);
    assert.strictEqual(created.pharmacy_id, 42);
  } finally {
    Customer.findOne = originalFindOne;
    Customer.create = originalCreate;
  }

  console.log('tenant-aware uniqueness guard test passed');
})();
