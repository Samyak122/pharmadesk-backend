const express = require("express");
const multer = require("multer");
const { Op } = require("sequelize");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { confirmSupplierInvoiceExtraction } = require("../services/supplierInvoiceOcrService");
const { extractInvoiceFromOpenAI, ensureImageIsSupported, MAX_IMAGE_BYTES, OCR_ALLOWED_MIME_TYPES } = require("../services/openAiOcrService");
const Medicine = require("../models/Medicine");
const Inventory = require("../models/Inventory");

router.get("/health", (req, res) => {
  return res.json({
    status: "ok",
    route: "/api/ocr",
    extract: "POST /api/ocr/extract",
  });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (!file) {
      callback(new Error("No invoice image was provided."));
      return;
    }

    if (!OCR_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new Error("Unsupported image type. Please upload a JPG, JPEG, PNG, or WEBP invoice."));
      return;
    }

    callback(null, true);
  },
});

router.post("/extract", authenticateToken, upload.single("invoice"), async (req, res) => {
  console.info("[OCR] request received", JSON.stringify({
    fileReceived: Boolean(req.file),
    mimeType: req.file?.mimetype || null,
    fileSize: req.file?.size || 0,
    pharmacyIdPresent: Boolean(req.user?.pharmacy_id),
  }));

  try {
    if (!req.user?.pharmacy_id) {
      return res.status(401).json({ message: "Authentication required for invoice extraction." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please upload a supplier invoice image." });
    }

    if (!ensureImageIsSupported(req.file)) {
      return res.status(400).json({ message: "Unsupported image type or file too large. Please upload a JPG, JPEG, PNG, or WEBP invoice under 8 MB." });
    }

    const extracted = await extractInvoiceFromOpenAI({
      fileBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    if (!Array.isArray(extracted.items) || extracted.items.length === 0) {
      return res.status(422).json({ message: "Could not read this invoice clearly. Please upload a clearer image." });
    }

    return res.json(extracted);
  } catch (error) {
    const message = error?.publicMessage || error?.message || "Unable to process the invoice. Please try again.";
    const isClientError = message.includes("upload") || message.includes("image type") || message.includes("too large");
    console.error("[OCR] request failed", JSON.stringify({
      code: error?.code || "OCR_FAILED",
      status: error?.details?.status || null,
      reason: error?.details?.reason || null,
      message,
    }));
    return res.status(isClientError ? 400 : 500).json({
      error: error?.code || "OCR_FAILED",
      message,
    });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError || error?.message?.includes("Unsupported image type")) {
    console.error("[OCR] upload failed", JSON.stringify({
      type: error?.code || error?.name || "UploadError",
      message: error?.message || "Invalid invoice upload",
    }));
    return res.status(400).json({
      error: "OCR_UPLOAD_FAILED",
      message: error?.message || "Please upload a valid invoice image.",
    });
  }
  return next(error);
});

router.post("/confirm", authenticateToken, async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await confirmSupplierInvoiceExtraction(payload, req.user?.pharmacy_id);
    return res.status(201).json({
      message: "OCR invoice items confirmed and added to inventory.",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to confirm supplier invoice import." });
  }
});

router.get("/catalog-match", authenticateToken, async (req, res) => {
  try {
    const { q } = req.query || {};
    if (!q || !String(q).trim()) {
      return res.status(400).json({ message: "Search term is required." });
    }

    const medicines = await Inventory.findAll({
      where: { pharmacy_id: req.user?.pharmacy_id },
      include: [{
        model: Medicine,
        as: "medicine",
        required: true,
        attributes: ["medicine_id", "medicine_name"],
      }],
      attributes: ["medicine_id"],
      limit: 20,
    });

    const unique = [];
    const seen = new Set();
    for (const row of medicines) {
      const name = row.medicine?.medicine_name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      unique.push({ medicine_id: row.medicine_id, medicine_name: name });
    }

    const searchTerm = String(q).trim();
    const filtered = unique.filter((item) => item.medicine_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return res.json(filtered.slice(0, 10));
  } catch (error) {
    return res.status(500).json({ message: "Unable to match supplier medicine names." });
  }
});

module.exports = router;
