const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

console.log("Current directory:", process.cwd());
console.log("DATABASE_URL =", process.env.DATABASE_URL);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

module.exports = sequelize;