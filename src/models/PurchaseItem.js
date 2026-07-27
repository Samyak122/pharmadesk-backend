const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Purchase = require("./Purchase");
const Inventory = require("./Inventory");

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
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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

Purchase.hasMany(PurchaseItem, {
  foreignKey: "purchase_id",
  as: "items",
});

module.exports = PurchaseItem;
