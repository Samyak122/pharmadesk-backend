const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Pharmacy = require("./Pharmacy");

const Customer = sequelize.define(
  "Customer",
  {
    customer_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    pharmacy_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Pharmacy,
        key: "pharmacy_id",
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "customers",
    timestamps: false,
    indexes: [
      {
        unique: true,
        name: "customers_pharmacy_phone_unique",
        fields: ["pharmacy_id", "phone"],
      },
      {
        unique: true,
        name: "customers_pharmacy_email_unique",
        fields: ["pharmacy_id", "email"],
      },
    ],
  }
);

Customer.belongsTo(Pharmacy, {
  foreignKey: "pharmacy_id",
  as: "pharmacy",
});

Pharmacy.hasMany(Customer, {
  foreignKey: "pharmacy_id",
  as: "customers",
});

module.exports = Customer;
