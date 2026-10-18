const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Purchase = require("./Purchase");
const Inventory = require("./Inventory");
const Pharmacy = require("./Pharmacy");

const PurchaseItem = sequelize.define(
  "PurchaseItem",
  {
    purchase_item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    purchase_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Purchase,
        key: "purchase_id",
      },
    },
    stock_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Inventory,
        key: "stock_id",
      },
    },
    // Purchase quantity remains the invoice's pack count; inventory conversion is separate.
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    free_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    units_per_pack: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    ocr_snapshot: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    unit_cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    pharmacy_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Pharmacy,
        key: "pharmacy_id",
      },
    },
  },
  {
    tableName: "purchase_items",
    timestamps: false,
  }
);

PurchaseItem.belongsTo(Purchase, {
  foreignKey: "purchase_id",
  as: "purchase",
});

PurchaseItem.belongsTo(Inventory, {
  foreignKey: "stock_id",
  as: "inventoryBatch",
});

Inventory.hasMany(PurchaseItem, {
  foreignKey: "stock_id",
  as: "purchaseItems",
});

Purchase.hasMany(PurchaseItem, {
  foreignKey: "purchase_id",
  as: "items",
});

PurchaseItem.belongsTo(Pharmacy, {
  foreignKey: "pharmacy_id",
  as: "pharmacy",
});

Pharmacy.hasMany(PurchaseItem, {
  foreignKey: "pharmacy_id",
  as: "purchaseItems",
});

module.exports = PurchaseItem;
