const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Medicine = require("./Medicine");
const Pharmacy = require("./Pharmacy");

const Inventory = sequelize.define(
  "Inventory",
  {
    stock_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    medicine_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Medicine,
        key: "medicine_id",
      },
    },
    batch_no: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    unit_cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    selling_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    min_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    location: {
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
    tableName: "inventory",
    timestamps: false,
    indexes: [
      {
        fields: ["medicine_id"],
      },
      {
        fields: ["expiry_date"],
      },
      {
        unique: true,
        fields: ["medicine_id", "batch_no", "is_active"],
      },
    ],
  }
);

Inventory.belongsTo(Medicine, {
  foreignKey: "medicine_id",
  as: "medicine",
});

Inventory.belongsTo(Pharmacy, {
  foreignKey: "pharmacy_id",
  as: "pharmacy",
});

Medicine.hasMany(Inventory, {
  foreignKey: "medicine_id",
  as: "inventoryBatches",
});

Pharmacy.hasMany(Inventory, {
  foreignKey: "pharmacy_id",
  as: "inventory",
});

module.exports = Inventory;
