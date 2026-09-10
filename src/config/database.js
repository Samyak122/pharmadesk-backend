const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || "sqlite::memory:";
const isSqlite = !process.env.DATABASE_URL || databaseUrl.startsWith("sqlite");

const sequelize = new Sequelize(databaseUrl, {
  dialect: isSqlite ? "sqlite" : "postgres",
  storage: isSqlite ? ":memory:" : undefined,
  logging: false,
  dialectOptions: isSqlite
    ? undefined
    : {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
});

module.exports = sequelize;