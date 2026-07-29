const customerService = require("../services/customerService");

exports.createCustomer = async (req, res) => {
  try {
    const customer = await customerService.createCustomer(req.body, req.user?.pharmacy_id);
    res.status(201).json({ message: "Customer created successfully", data: customer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.listCustomers = async (req, res) => {
  try {
    const customers = await customerService.listCustomers(req.query.search || "", req.user?.pharmacy_id);
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await customerService.getCustomerById(Number(req.params.customer_id), req.user?.pharmacy_id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const updated = await customerService.updateCustomer(Number(req.params.customer_id), req.body, req.user?.pharmacy_id);
    if (!updated) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({ message: "Customer updated successfully", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const removed = await customerService.deleteCustomer(Number(req.params.customer_id), req.user?.pharmacy_id);
    if (!removed) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.searchByPhone = async (req, res) => {
  try {
    const customers = await customerService.searchByPhone(req.query.phone || "", req.user?.pharmacy_id);
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getCustomerHistory = async (req, res) => {
  try {
    const data = await customerService.getCustomerHistory(Number(req.params.customer_id), req.user?.pharmacy_id);
    if (!data) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
