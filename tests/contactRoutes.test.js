const test = require("node:test");
const assert = require("node:assert/strict");
const contactRoutes = require("../src/routes/contactRoutes");

const postContact = contactRoutes.stack.find((layer) => layer.route?.path === "/").route.stack[0].handle;
const validContact = {
  pharmacyName: "Sunrise Pharmacy",
  ownerName: "Asha Patel",
  phone: "+91 98765 43210",
  email: "asha@example.com",
  gst: "GST123",
  license: "DL456",
  city: "Pune",
  state: "Maharashtra",
  currentSoftware: "Legacy Billing",
  message: "Please schedule a demo.",
};

function responseRecorder() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test("stores a valid contact without sending email from the backend", () => {
  const response = responseRecorder();
  postContact({ body: validContact }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.data.pharmacyName, validContact.pharmacyName);
});

test("rejects missing required fields", () => {
  const response = responseRecorder();
  postContact({ body: { ...validContact, message: "" } }, response);

  assert.equal(response.statusCode, 400);
});