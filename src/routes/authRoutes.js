const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validate, authRegisterSchema, authLoginSchema } = require("../utils/validation");

router.post("/register", validate(authRegisterSchema), authController.register);
router.post("/login", validate(authLoginSchema), authController.login);

module.exports = router;