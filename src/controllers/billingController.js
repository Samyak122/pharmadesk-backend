const billingService = require("../services/billingService");

exports.createInvoice = async (req, res) => {
  try {
    const result = await billingService.createInvoice(req.body);
    res.status(201).json({ message: "Invoice created successfully", data: result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "Server Error" });
  }
};

exports.listInvoices = async (req, res) => {
  try {
    const invoices = await billingService.listInvoices();
    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await billingService.getInvoiceById(Number(req.params.invoice_id));
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
