const authService = require("../services/authService");

exports.register = async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json({ message: "User registered successfully", data: result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "Server Error" });
  }
};

exports.login = async (req, res) => {
  try {
    const result = await authService.loginUser(req.body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "Server Error" });
  }
};
