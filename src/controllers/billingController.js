const billingService = require("../services/billingService");

exports.createInvoice = async (req, res) => {
  try {
    const result = await billingService.createInvoice(req.body, req.user?.pharmacy_id);
    res.status(201).json({ message: "Invoice created successfully", data: result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "Server Error" });
  }
};

exports.listInvoices = async (req, res) => {
  try {
    const invoices = await billingService.listInvoices(req.user?.pharmacy_id);
    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await billingService.getInvoiceById(Number(req.params.invoice_id), req.user?.pharmacy_id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const result = await billingService.updateInvoice(Number(req.params.invoice_id), req.body, req.user?.pharmacy_id);
    res.json({ message: "Invoice updated successfully", data: result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "Server Error" });
  }
};
