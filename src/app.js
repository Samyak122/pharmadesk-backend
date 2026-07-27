const express = require("express");
const cors = require("cors");
require("dotenv").config();

const sequelize = require("./config/database");
const medicineRoutes = require("./routes/medicineRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const customerRoutes = require("./routes/customerRoutes");
const billingRoutes = require("./routes/billingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const authRoutes = require("./routes/authRoutes");

const Medicine = require("./models/Medicine");
const Inventory = require("./models/Inventory");
const Supplier = require("./models/Supplier");
const Purchase = require("./models/Purchase");
const PurchaseItem = require("./models/PurchaseItem");
const Customer = require("./models/Customer");
const Invoice = require("./models/Invoice");
const InvoiceItem = require("./models/InvoiceItem");
const User = require("./models/User");
const PharmacySetting = require("./models/PharmacySetting");

const { authenticateToken, authorizeRoles } = require("./middleware/authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/inventory", authenticateToken, inventoryRoutes);
app.use("/api/purchases", authenticateToken, purchaseRoutes);
app.use("/api/customers", authenticateToken, customerRoutes);
app.use("/api/billing", authenticateToken, billingRoutes);
app.use("/api/dashboard", authenticateToken, dashboardRoutes);
app.use("/api/reports", authenticateToken, reportRoutes);
app.use("/api/settings", authenticateToken, settingsRoutes);

app.get("/", (req, res) => {
  res.send("PharmaDesk Backend Running 🚀");
});

const PORT = process.env.PORT || 5000;

sequelize
  .authenticate()
  .then(async () => {
    console.log("✅ Database Connected Successfully");

    await sequelize.sync({ alter: true });
    console.log("✅ Database synced");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database Connection Failed");
    console.error(err);
  });