const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    {
      userId: user.user_id,
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

  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, password_hash, role: normalizedRole });

  return {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
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
