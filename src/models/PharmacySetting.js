const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Pharmacy = require("./Pharmacy");

const PharmacySetting = sequelize.define(
  "PharmacySetting",
  {
    setting_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pharmacy_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Pharmacy,
        key: "pharmacy_id",
      },
    },
    pharmacy_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    owner_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    gstin: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    drug_license_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    address_line_1: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    address_line_2: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    pin_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    phone_number: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    logo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invoice_footer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "INR",
    },
    timezone: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "Asia/Kolkata",
    },
  },
  {
    tableName: "pharmacy_settings",
    timestamps: false,
  }
);

PharmacySetting.belongsTo(Pharmacy, {
  foreignKey: "pharmacy_id",
  as: "pharmacy",
});

Pharmacy.hasMany(PharmacySetting, {
  foreignKey: "pharmacy_id",
  as: "settings",
});

module.exports = PharmacySetting;
