const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Pharmacy = require("./Pharmacy");

const Supplier = sequelize.define(
  "Supplier",
  {
    supplier_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    supplier_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    gst_number: {
      type: DataTypes.STRING(100),
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
    tableName: "suppliers",
    timestamps: false,
    indexes: [
      {
        unique: true,
        name: "suppliers_pharmacy_phone_unique",
        fields: ["pharmacy_id", "phone"],
      },
      {
        unique: true,
        name: "suppliers_pharmacy_email_unique",
        fields: ["pharmacy_id", "email"],
      },
    ],
  }
);

Supplier.belongsTo(Pharmacy, {
  foreignKey: "pharmacy_id",
  as: "pharmacy",
});

Pharmacy.hasMany(Supplier, {
  foreignKey: "pharmacy_id",
  as: "suppliers",
});

module.exports = Supplier;
