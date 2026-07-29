const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Invoice = require("./Invoice");
const Inventory = require("./Inventory");
const Pharmacy = require("./Pharmacy");

const InvoiceItem = sequelize.define(
  "InvoiceItem",
  {
    invoice_item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Invoice,
        key: "invoice_id",
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
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_price: {
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
    tableName: "invoice_items",
    timestamps: false,
  }
);

InvoiceItem.belongsTo(Invoice, {
  foreignKey: "invoice_id",
  as: "invoice",
});

InvoiceItem.belongsTo(Inventory, {
  foreignKey: "stock_id",
  as: "inventoryBatch",
});

Invoice.hasMany(InvoiceItem, {
  foreignKey: "invoice_id",
  as: "items",
});

InvoiceItem.belongsTo(Pharmacy, {
  foreignKey: "pharmacy_id",
  as: "pharmacy",
});

Pharmacy.hasMany(InvoiceItem, {
  foreignKey: "pharmacy_id",
  as: "invoiceItems",
});

module.exports = InvoiceItem;
