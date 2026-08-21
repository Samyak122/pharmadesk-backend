const Joi = require("joi");

const emailSchema = Joi.string().email({ tlds: { allow: false } }).trim();
const phoneSchema = Joi.string().pattern(/^[0-9+\-()\s]{7,15}$/).trim();
const positiveIntSchema = Joi.number().integer().positive();
const nonNegativeIntSchema = Joi.number().integer().min(0);
const dateSchema = Joi.date().iso();

const authRegisterSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  password: Joi.string().min(6).max(100).required(),
  email: emailSchema.optional(),
  role: Joi.string().valid("Admin", "Pharmacist").required(),
  pharmacy_name: Joi.string().trim().max(200).optional(),
  owner_name: Joi.string().trim().max(200).optional(),
  phone: Joi.string().trim().max(30).optional(),
  gstin: Joi.string().trim().max(100).optional(),
  license_no: Joi.string().trim().max(100).optional(),
  pharmacy_email: emailSchema.optional(),
});

const authLoginSchema = Joi.object({
  username: Joi.string().trim().min(3).required(),
  password: Joi.string().min(6).required(),
});

const inventorySchema = Joi.object({
  medicine_id: positiveIntSchema.required(),
  batch_no: Joi.string().trim().min(1).max(100).required(),
  expiry_date: Joi.string().required(),
  quantity: nonNegativeIntSchema.required(),
  unit_cost: Joi.number().min(0).required(),
  selling_price: Joi.number().min(0).required(),
  min_stock: nonNegativeIntSchema.optional(),
  location: Joi.string().trim().max(100).optional(),
});

const inventoryUpdateSchema = Joi.object({
  batch_no: Joi.string().trim().min(1).max(100).optional(),
  expiry_date: Joi.string().optional(),
  quantity: nonNegativeIntSchema.optional(),
  unit_cost: Joi.number().min(0).optional(),
  selling_price: Joi.number().min(0).optional(),
  min_stock: nonNegativeIntSchema.optional(),
  location: Joi.string().trim().max(100).optional(),
});

const customerSchema = Joi.object({
  customer_name: Joi.string().trim().min(2).max(150).required(),
  phone: phoneSchema.required(),
  email: emailSchema.allow(""),
  address: Joi.string().trim().max(500).allow(""),
  date_of_birth: Joi.string().optional(),
});

const purchaseItemSchema = Joi.object({
  medicine_id: positiveIntSchema.required(),
  batch_no: Joi.string().trim().min(1).max(100).required(),
  expiry_date: Joi.string().required(),
  quantity: positiveIntSchema.required(),
  unit_cost: Joi.number().min(0).required(),
  selling_price: Joi.number().min(0).required(),
  min_stock: nonNegativeIntSchema.optional(),
  location: Joi.string().trim().max(100).optional(),
});

const purchaseSchema = Joi.object({
  supplier_id: positiveIntSchema.optional(),
  invoice_no: Joi.string().trim().max(100).optional(),
  notes: Joi.string().trim().max(500).optional(),
  payment_status: Joi.string().trim().max(50).optional(),
  items: Joi.array().items(purchaseItemSchema).min(1).required(),
});

const settingsSchema = Joi.object({
  pharmacy_name: Joi.string().trim().max(200).optional(),
  owner_name: Joi.string().trim().max(200).optional(),
  gstin: Joi.string().trim().max(100).optional(),
  drug_license_number: Joi.string().trim().max(100).optional(),
  address_line_1: Joi.string().trim().max(300).optional(),
  address_line_2: Joi.string().trim().max(300).optional(),
  city: Joi.string().trim().max(150).optional(),
  state: Joi.string().trim().max(150).optional(),
  pin_code: Joi.string().trim().max(20).optional(),
  phone_number: Joi.string().trim().max(30).optional(),
  email: emailSchema.optional(),
  website: Joi.string().trim().max(200).optional(),
  logo_url: Joi.string().trim().max(500).optional(),
  invoice_footer: Joi.string().trim().max(1000).optional(),
  currency: Joi.string().trim().max(20).optional(),
  timezone: Joi.string().trim().max(100).optional(),
});

const invoiceItemSchema = Joi.object({
  medicine_id: positiveIntSchema.required(),
  quantity: positiveIntSchema.required(),
  unit_price: Joi.number().min(0).required(),
  discount_amount: Joi.number().min(0).optional(),
});

const billingSchema = Joi.object({
  customer_id: positiveIntSchema.optional(),
  invoice_no: Joi.string().trim().min(1).max(100).required(),
  invoice_date: Joi.string().optional(),
  payment_method: Joi.string().trim().max(50).optional(),
  payment_status: Joi.string().trim().max(50).optional(),
  gst_percent: Joi.number().min(0).max(100).optional(),
  discount_amount: Joi.number().min(0).optional(),
  notes: Joi.string().trim().max(500).optional(),
  items: Joi.array().items(invoiceItemSchema).min(1).required(),
});

function validate(schema, source = "body") {
  return (req, res, next) => {
    const data = source === "query" ? req.query : req.body;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });

    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        details: error.details.map((detail) => detail.message),
      });
    }

    if (source === "query") {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
}

module.exports = {
  validate,
  authRegisterSchema,
  authLoginSchema,
  inventorySchema,
  inventoryUpdateSchema,
  customerSchema,
  purchaseSchema,
  settingsSchema,
  billingSchema,
  positiveIntSchema,
  phoneSchema,
};
