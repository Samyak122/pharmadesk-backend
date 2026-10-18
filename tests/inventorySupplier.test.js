const assert = require("node:assert/strict");
const test = require("node:test");
const Inventory = require("../src/models/Inventory");
const inventoryService = require("../src/services/inventoryService");

test("inventory list resolves each batch's supplier without unscoped follow-up queries", async () => {
  const originalFindAll = Inventory.findAll;
  let findAllCalls = 0;
  let query;
  Inventory.findAll = async (options) => {
    findAllCalls += 1;
    query = options;
    return [
      {
        toJSON: () => ({
          stock_id: 1,
          medicine_id: 12,
          pharmacy_id: 7,
          purchaseItems: [{ purchase: { supplier: { supplier_name: "North Supplier" } } }],
        }),
      },
      {
        toJSON: () => ({
          stock_id: 2,
          medicine_id: 12,
          pharmacy_id: 7,
          purchaseItems: [{ purchase: { supplier: { supplier_name: "South Supplier" } } }],
        }),
      },
      {
        toJSON: () => ({ stock_id: 3, medicine_id: 12, pharmacy_id: 7, purchaseItems: [] }),
      },
    ];
  };

  try {
    const rows = await inventoryService.listInventory({ pharmacyId: 7, search: "" });
    assert.equal(findAllCalls, 1);
    assert.deepEqual(rows.map((row) => row.supplier_name), ["North Supplier", "South Supplier", "Not specified"]);
    assert.equal(query.where.pharmacy_id, 7);
    const purchaseItemsInclude = query.include.find((include) => include.as === "purchaseItems");
    assert.equal(purchaseItemsInclude.where.pharmacy_id, 7);
    assert.equal(purchaseItemsInclude.include[0].where.pharmacy_id, 7);
    assert.equal(purchaseItemsInclude.include[0].include[0].where.pharmacy_id, 7);
  } finally {
    Inventory.findAll = originalFindAll;
  }
});

test("inventory batch supplier names can list multiple associated purchases", async () => {
  const originalFindAll = Inventory.findAll;
  Inventory.findAll = async () => [{
    toJSON: () => ({
      stock_id: 9,
      purchaseItems: [
        { purchase: { supplier: { supplier_name: "Supplier A" } } },
        { purchase: { supplier: { supplier_name: "Supplier B" } } },
        { purchase: { supplier: { supplier_name: "Supplier A" } } },
      ],
    }),
  }];

  try {
    const [batch] = await inventoryService.listInventory({ pharmacyId: 2 });
    assert.equal(batch.supplier_name, "Supplier A, Supplier B");
  } finally {
    Inventory.findAll = originalFindAll;
  }
});
