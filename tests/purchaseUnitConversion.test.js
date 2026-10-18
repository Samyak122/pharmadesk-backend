const assert = require("node:assert/strict");
const test = require("node:test");
const sequelize = require("../src/config/database");
const Inventory = require("../src/models/Inventory");
const Medicine = require("../src/models/Medicine");
const Purchase = require("../src/models/Purchase");
const PurchaseItem = require("../src/models/PurchaseItem");
const Supplier = require("../src/models/Supplier");
const purchaseService = require("../src/services/purchaseService");

const originalMethods = {
  transaction: sequelize.transaction,
  supplierFindOne: Supplier.findOne,
  purchaseCreate: Purchase.create,
  medicineFindByPk: Medicine.findByPk,
  inventoryFindOne: Inventory.findOne,
  inventoryCreate: Inventory.create,
  purchaseItemCreate: PurchaseItem.create,
};

test.afterEach(() => {
  sequelize.transaction = originalMethods.transaction;
  Supplier.findOne = originalMethods.supplierFindOne;
  Purchase.create = originalMethods.purchaseCreate;
  Medicine.findByPk = originalMethods.medicineFindByPk;
  Inventory.findOne = originalMethods.inventoryFindOne;
  Inventory.create = originalMethods.inventoryCreate;
  PurchaseItem.create = originalMethods.purchaseItemCreate;
});

test("purchase import records invoice quantities and adds converted individual units exactly once", async () => {
  const inventoryBatch = {
    stock_id: 44,
    quantity: 0,
    units_per_pack: 6,
    unit_cost: 0,
    selling_price: 20,
    min_stock: 5,
    update: async (values) => Object.assign(inventoryBatch, values),
  };
  let inventoryUpdates = 0;
  const updateBatch = inventoryBatch.update;
  inventoryBatch.update = async (values, options) => {
    inventoryUpdates += 1;
    return updateBatch(values, options);
  };
  let savedPurchaseItem;
  sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {}, LOCK: { UPDATE: "UPDATE" } });
  Purchase.create = async (data) => ({ ...data, purchase_id: 12 });
  Medicine.findByPk = async (medicineId) => ({ medicine_id: medicineId, is_narcotic: false, is_schedule_h1: false });
  Supplier.findOne = async () => null;
  Inventory.findOne = async () => null;
  Inventory.create = async (data) => ({ ...data, stock_id: inventoryBatch.stock_id, update: inventoryBatch.update });
  PurchaseItem.create = async (data) => {
    savedPurchaseItem = data;
    return data;
  };

  const result = await purchaseService.createPurchase({
    items: [{
      medicine_id: 7,
      batch_no: "PACK-6",
      expiry_date: "2028-10-01",
      quantity: 5,
      free_quantity: 1,
      units_per_pack: 6,
      unit_cost: 90,
      selling_price: 20,
      ocr_snapshot: { quantity: 5, free_quantity: 1, units_per_pack: 6, mrp: 120, purchase_rate: 90 },
    }],
  }, 3);

  assert.equal(inventoryBatch.quantity, 36);
  assert.equal(inventoryBatch.units_per_pack, 6);
  assert.equal(inventoryBatch.unit_cost, 15);
  assert.equal(inventoryBatch.selling_price, 20);
  assert.equal(inventoryUpdates, 1);
  assert.equal(savedPurchaseItem.quantity, 5);
  assert.equal(savedPurchaseItem.free_quantity, 1);
  assert.equal(savedPurchaseItem.units_per_pack, 6);
  assert.deepEqual(savedPurchaseItem.ocr_snapshot, { quantity: 5, free_quantity: 1, units_per_pack: 6, mrp: 120, purchase_rate: 90 });
  assert.equal(result.summary.totalIndividualUnits, 36);
});

test("purchase pack size must be a positive whole number", async () => {
  sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {} });
  Purchase.create = async () => ({ purchase_id: 1 });
  Medicine.findByPk = async () => ({ medicine_id: 7 });
  Supplier.findOne = async () => null;

  Inventory.findOne = async () => null;
  const invalidPackSizes = [0, -1, 1.5, "invalid"];
  for (const [index, units_per_pack] of invalidPackSizes.entries()) {
    await assert.rejects(purchaseService.createPurchase({
      items: [{
        medicine_id: 7,
        batch_no: `BAD-PACK-${index}`,
        expiry_date: "2028-10-01",
        quantity: 5,
        units_per_pack,
        unit_cost: 90,
        selling_price: 20,
      }],
    }, 3), /Units per Pack must be a positive whole number/);
  }
});
