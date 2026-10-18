const assert = require("node:assert/strict");
const test = require("node:test");
const sequelize = require("../src/config/database");
const Invoice = require("../src/models/Invoice");
const InvoiceItem = require("../src/models/InvoiceItem");
const Inventory = require("../src/models/Inventory");
const Medicine = require("../src/models/Medicine");
const billingService = require("../src/services/billingService");

const originalMethods = {
  transaction: sequelize.transaction,
  invoiceFindOne: Invoice.findOne,
  invoiceCreate: Invoice.create,
  invoiceItemBulkCreate: InvoiceItem.bulkCreate,
  invoiceItemFindAll: InvoiceItem.findAll,
  invoiceItemDestroy: InvoiceItem.destroy,
  inventoryFindAll: Inventory.findAll,
  inventoryFindByPk: Inventory.findByPk,
  inventoryFindOne: Inventory.findOne,
  medicineFindByPk: Medicine.findByPk,
};

test.afterEach(() => {
  sequelize.transaction = originalMethods.transaction;
  Invoice.findOne = originalMethods.invoiceFindOne;
  Invoice.create = originalMethods.invoiceCreate;
  InvoiceItem.bulkCreate = originalMethods.invoiceItemBulkCreate;
  InvoiceItem.findAll = originalMethods.invoiceItemFindAll;
  InvoiceItem.destroy = originalMethods.invoiceItemDestroy;
  Inventory.findAll = originalMethods.inventoryFindAll;
  Inventory.findByPk = originalMethods.inventoryFindByPk;
  Inventory.findOne = originalMethods.inventoryFindOne;
  Medicine.findByPk = originalMethods.medicineFindByPk;
});

function stubBillingModels({ batch, medicines = {} }) {
  let nextInvoiceId = 1;
  const savedItems = [];
  sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {}, LOCK: { UPDATE: "UPDATE" } });
  Invoice.findOne = async () => null;
  Invoice.create = async (data) => ({ ...data, invoice_id: nextInvoiceId++ });
  InvoiceItem.bulkCreate = async (items) => {
    savedItems.push(...items);
    return items;
  };
  Inventory.findAll = async () => [batch];
  Medicine.findByPk = async (medicineId) => medicines[medicineId] || ({
    medicine_id: medicineId,
    is_narcotic: false,
    is_schedule_h1: false,
  });
  return savedItems;
}

test("full-pack, loose, and mixed billing deduct individual stock once and preserve invoice totals", async () => {
  const batch = {
    stock_id: 30,
    quantity: 35,
    units_per_pack: 10,
    selling_price: 2,
    update: async (values) => Object.assign(batch, values),
  };
  const savedItems = stubBillingModels({ batch });

  const create = (invoiceNo, item, extra = {}) => billingService.createInvoice({
    invoice_no: invoiceNo,
    gst_percent: 10,
    ...extra,
    items: [{ medicine_id: 11, unit_price: 2, ...item }],
  }, 4);

  const fullPack = await create("PACK-1", {
    quantity: 20, sale_unit: "pack", pack_quantity: 2, loose_quantity: 0, units_per_pack: 10,
  }, { discount_amount: 5 });
  assert.equal(batch.quantity, 15);
  assert.equal(fullPack.totals.subtotal, 40);
  assert.equal(fullPack.totals.gstAmount, 3.5);
  assert.equal(fullPack.totals.totalAmount, 38.5);

  await create("LOOSE-1", {
    quantity: 2, sale_unit: "loose", pack_quantity: 0, loose_quantity: 2, units_per_pack: 10,
  });
  assert.equal(batch.quantity, 13);

  await create("MIXED-1", {
    quantity: 12, sale_unit: "mixed", pack_quantity: 1, loose_quantity: 2, units_per_pack: 10,
  });
  assert.equal(batch.quantity, 1);
  assert.deepEqual(savedItems.map(({ pack_quantity, loose_quantity, quantity }) => ({ pack_quantity, loose_quantity, quantity })), [
    { pack_quantity: 2, loose_quantity: 0, quantity: 20 },
    { pack_quantity: 0, loose_quantity: 2, quantity: 2 },
    { pack_quantity: 1, loose_quantity: 2, quantity: 12 },
  ]);

  await assert.rejects(create("INSUFFICIENT-1", {
    quantity: 10, sale_unit: "pack", pack_quantity: 1, loose_quantity: 0, units_per_pack: 10,
  }), /Insufficient full-pack stock/);
  assert.equal(batch.quantity, 1);
  assert.equal(savedItems.length, 3);
});

test("full-pack billing cannot use stock with a different stored pack size", async () => {
  const batch = {
    stock_id: 31,
    quantity: 50,
    units_per_pack: 6,
    selling_price: 1,
    update: async (values) => Object.assign(batch, values),
  };
  stubBillingModels({ batch });

  await assert.rejects(billingService.createInvoice({
    invoice_no: "WRONG-PACK",
    items: [{
      medicine_id: 11,
      quantity: 20,
      unit_price: 1,
      sale_unit: "pack",
      pack_quantity: 2,
      loose_quantity: 0,
      units_per_pack: 10,
    }],
  }, 4), /No available stock/);
  assert.equal(batch.quantity, 50);
});

test("invoice items snapshot H1 and narcotic flags for every flag combination", async () => {
  const flags = [
    { is_schedule_h1: true, is_narcotic: false },
    { is_schedule_h1: false, is_narcotic: true },
    { is_schedule_h1: true, is_narcotic: true },
    { is_schedule_h1: false, is_narcotic: false },
  ];
  const medicines = Object.fromEntries(flags.map((item, index) => [index + 1, { medicine_id: index + 1, ...item }]));
  const batch = {
    stock_id: 32,
    quantity: 100,
    units_per_pack: 1,
    selling_price: 1,
    update: async (values) => Object.assign(batch, values),
  };
  const savedItems = stubBillingModels({ batch, medicines });

  for (let index = 0; index < flags.length; index += 1) {
    await billingService.createInvoice({
      invoice_no: `CLASS-${index}`,
      items: [{ medicine_id: index + 1, quantity: 1, unit_price: 1 }],
    }, 4);
  }

  assert.deepEqual(savedItems.map(({ is_schedule_h1, is_narcotic }) => ({ is_schedule_h1, is_narcotic })), flags);
});

test("editing a billed invoice restores prior stock before deducting the edited pack quantity", async () => {
  const batch = {
    stock_id: 33,
    quantity: 19,
    units_per_pack: 10,
    selling_price: 2,
    update: async (values) => Object.assign(batch, values),
  };
  const existingInvoice = {
    invoice_id: 8,
    pharmacy_id: 4,
    invoice_no: "EDIT-1",
    update: async (values) => Object.assign(existingInvoice, values),
  };
  let invoiceLookupCount = 0;
  let savedItems = [];
  sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {}, LOCK: { UPDATE: "UPDATE" } });
  Invoice.findOne = async () => {
    invoiceLookupCount += 1;
    return invoiceLookupCount === 2 ? null : existingInvoice;
  };
  InvoiceItem.findAll = async () => [{ stock_id: batch.stock_id, quantity: 1 }];
  InvoiceItem.destroy = async () => {};
  InvoiceItem.bulkCreate = async (items) => {
    savedItems = items;
    return items;
  };
  Inventory.findOne = async () => batch;
  Inventory.findAll = async () => [batch];
  Medicine.findByPk = async (medicineId) => ({ medicine_id: medicineId, is_narcotic: true, is_schedule_h1: true });

  await billingService.updateInvoice(8, {
    invoice_no: "EDIT-1",
    items: [{
      medicine_id: 11,
      quantity: 20,
      unit_price: 2,
      sale_unit: "pack",
      pack_quantity: 2,
      loose_quantity: 0,
      units_per_pack: 10,
    }],
  }, 4);

  assert.equal(batch.quantity, 0);
  assert.equal(savedItems[0].quantity, 20);
  assert.equal(savedItems[0].pack_quantity, 2);
  assert.equal(savedItems[0].is_narcotic, true);
  assert.equal(savedItems[0].is_schedule_h1, true);
});
