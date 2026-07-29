const purchaseService = require("../services/purchaseService");

exports.createPurchase = async (req, res) => {
  try {
    const result = await purchaseService.createPurchase(req.body, req.user?.pharmacy_id);
    res.status(201).json({
      message: "Purchase created successfully",
      data: result,
    });
  } catch (error) {
    console.error(error);
    const status = error.message.includes("not found") || error.message.includes("required") ? 400 : 500;
    res.status(status).json({ message: error.message || "Server Error" });
  }
};

exports.listPurchases = async (req, res) => {
  try {
    const purchases = await purchaseService.listPurchases(req.user?.pharmacy_id);
    res.json(purchases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getPurchaseById = async (req, res) => {
  try {
    const purchase = await purchaseService.getPurchaseById(Number(req.params.purchase_id), req.user?.pharmacy_id);
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    res.json(purchase);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
