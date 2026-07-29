const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Pharmacy = sequelize.define(
  "Pharmacy",
  {
    pharmacy_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pharmacy_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    owner_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    gstin: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    license_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "pharmacies",
    timestamps: false,
  }
);

module.exports = Pharmacy;
