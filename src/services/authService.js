const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sequelize = require("../config/database");
const User = require("../models/User");
const Pharmacy = require("../models/Pharmacy");

function signToken(user) {
  return jwt.sign(
    {
      userId: user.user_id,
      user_id: user.user_id,
      pharmacy_id: user.pharmacy_id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET || "pharmadesk-secret",
    { expiresIn: "8h" }
  );
}

async function registerUser(payload) {
  const { username, password, email, role } = payload;

  const normalizedRole = role === "Admin" || role === "Pharmacist" ? role : null;

  if (!normalizedRole) {
    throw new Error("Role must be either Admin or Pharmacist.");
  }

  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  const existing = await User.findOne({ where: { username } });
  if (existing) {
    throw new Error("Username already exists.");
  }

  const transaction = await sequelize.transaction();

  try {
    const pharmacyName = payload.pharmacy_name || payload.pharmacyName || username;
    const pharmacy = await Pharmacy.create(
      {
        pharmacy_name: pharmacyName,
        owner_name: payload.owner_name || payload.ownerName || username,
        email: payload.pharmacy_email || payload.pharmacyEmail || email || null,
        phone: payload.phone || null,
        gstin: payload.gstin || null,
        license_no: payload.license_no || payload.licenseNo || null,
      },
      { transaction }
    );

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create(
      {
        username,
        email,
        password_hash,
        role: normalizedRole,
        pharmacy_id: pharmacy.pharmacy_id,
      },
      { transaction }
    );

    await transaction.commit();

    return {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function loginUser(payload) {
  const { username, password } = payload;

  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  const user = await User.findOne({ where: { username, is_active: true } });
  if (!user) {
    throw new Error("Invalid username or password.");
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new Error("Invalid username or password.");
  }

  const token = signToken(user);

  return {
    token,
    user: {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  };
}

module.exports = {
  registerUser,
  loginUser,
  signToken,
};
