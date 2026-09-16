const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Medicine = sequelize.define(
  "Medicine",
  {
    medicine_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    medicine_name: DataTypes.STRING,
    composition: DataTypes.TEXT,
    manufacturer: DataTypes.STRING,
    uses: DataTypes.TEXT,
    side_effects: DataTypes.TEXT,
    image_url: DataTypes.TEXT,
    is_narcotic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_schedule_h1: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    excellent_review: DataTypes.DECIMAL,
    average_review: DataTypes.DECIMAL,
    poor_review: DataTypes.DECIMAL,
  },
  {
    tableName: "medicine_master",
    timestamps: false,
  }
);

module.exports = Medicine;