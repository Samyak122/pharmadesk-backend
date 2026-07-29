const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Customer = require("./Customer");
const Pharmacy = require("./Pharmacy");

const Invoice = sequelize.define(
  "Invoice",
  {
    invoice_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Customer,
        key: "customer_id",
      },
    },
    invoice_no: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    invoice_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discount_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    gst_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
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
    tableName: "invoices",
    timestamps: false,
    indexes: [
      {
        unique: true,
        name: "invoices_pharmacy_invoice_no_unique",
        fields: ["pharmacy_id", "invoice_no"],
      },
    ],
  }
);

Invoice.belongsTo(Customer, {
  foreignKey: "customer_id",
  as: "customer",
});

Customer.hasMany(Invoice, {
  foreignKey: "customer_id",
  as: "invoices",
});

Invoice.belongsTo(Pharmacy, {
  foreignKey: "pharmacy_id",
  as: "pharmacy",
});

Pharmacy.hasMany(Invoice, {
  foreignKey: "pharmacy_id",
  as: "invoices",
});

module.exports = Invoice;
