const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Supplier = require("./Supplier");
const Pharmacy = require("./Pharmacy");

const Purchase = sequelize.define(
  "Purchase",
  {
    purchase_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Supplier,
        key: "supplier_id",
      },
    },
    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    invoice_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    payment_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Pending",
    },
    pharmacy_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Pharmacy,
        key: "pharmacy_id",
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "purchases",
    timestamps: false,
  }
);

Purchase.belongsTo(Supplier, {
  foreignKey: "supplier_id",
  as: "supplier",
});

Supplier.hasMany(Purchase, {
  foreignKey: "supplier_id",
  as: "purchases",
});

Purchase.belongsTo(Pharmacy, {
  foreignKey: "pharmacy_id",
  as: "pharmacy",
});

Pharmacy.hasMany(Purchase, {
  foreignKey: "pharmacy_id",
  as: "purchases",
});

module.exports = Purchase;
