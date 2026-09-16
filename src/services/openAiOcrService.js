const OpenAI = require("openai");

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OCR_DEFAULT_MODEL = "openrouter/free";
const OCR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = Number(process.env.OPENAI_OCR_MAX_BYTES || 8 * 1024 * 1024);

function logOcr(event, details = {}) {
  console.info(`[OCR] ${event}`, JSON.stringify(details));
}

function getSafeOpenRouterError(error) {
  return {
    type: error?.type || error?.name || "OpenRouterError",
    status: error?.status || error?.statusCode || null,
    message: error?.error?.message || error?.message || "Unknown OpenAI error",
    code: error?.code || error?.error?.code || null,
  };
}

function createOcrError(message, details = {}) {
  const error = new Error(message);
  error.code = "OCR_FAILED";
  error.publicMessage = message;
  error.details = details;
  return error;
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\r/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMedicineName(value) {
  return normalizeWhitespace(value)
    .replace(/[^A-Za-z0-9%/().,\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInvoiceDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;

  const monthNames = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  };

  const compact = text.replace(/\s+/g, "").replace(/\./g, "/");
  const monthYearMatch = compact.match(/^([A-Za-z]{3,9})[-/ ]?(\d{2,4})$/i)
    || compact.match(/^(\d{1,2})[-/](\d{4})$/)
    || compact.match(/^(\d{4})[-/](\d{1,2})$/);

  if (monthYearMatch) {
    const first = monthYearMatch[1];
    const second = monthYearMatch[2];
    if (Number.isNaN(Number(first)) && monthNames[first.toUpperCase()]) {
      const month = monthNames[first.toUpperCase()];
      const year = Number(second);
      if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
        return `${year}-${String(month).padStart(2, "0")}-01`;
      }
    }

    const month = Number(first) || Number(second);
    const year = Number(second) || Number(first);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }

  const datePatterns = [
    /^([0-9]{1,2})[-/ ]([0-9]{1,2})[-/ ]([0-9]{2,4})$/,
    /^([0-9]{4})[-/ ]([0-9]{1,2})[-/ ]([0-9]{1,2})$/,
  ];

  for (const pattern of datePatterns) {
    const match = compact.match(pattern);
    if (!match) continue;

    const a = match[1];
    const b = match[2];
    const c = match[3];
    let day; let month; let year;

    if (a.length === 4) {
      year = Number(a);
      month = Number(b);
      day = Number(c);
    } else {
      const first = Number(a);
      const second = Number(b);
      const third = Number(c);
      if (c.length === 2) {
        year = 2000 + third;
        if (first <= 31 && second <= 12) {
          day = first;
          month = second;
        } else if (second <= 31 && first <= 12) {
          day = second;
          month = first;
        } else {
          continue;
        }
      } else {
        day = first;
        month = second;
        year = third;
      }
    }

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) continue;
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const isoDate = new Date(Date.UTC(year, month - 1, day));
    if (isoDate.getUTCFullYear() !== year || (isoDate.getUTCMonth() + 1) !== month || isoDate.getUTCDate() !== day) continue;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function validateGstin(value) {
  if (value === null || value === undefined || value === "") return null;
  const gstin = String(value).trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) return null;
  return gstin;
}

function safeString(value, fallback = null) {
  const text = normalizeWhitespace(value);
  return text || fallback;
}

function parseNullableNumber(value) {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return parsed;
}

function sanitizeOcrJson(rawJson) {
  const source = rawJson && typeof rawJson === "object" ? rawJson : {};
  const supplier = source.supplier || {};
  const invoice = source.invoice || {};
  const items = Array.isArray(source.items) ? source.items : [];
  const totals = source.totals || {};

  const normalizedSupplier = {
    name: safeString(supplier.name, null),
    gstin: validateGstin(supplier.gstin),
    address: safeString(supplier.address, null),
    phone: safeString(supplier.phone, null),
  };

  const normalizedInvoice = {
    number: safeString(invoice.number, null),
    date: normalizeInvoiceDate(invoice.date),
  };

  const normalizedItems = items.map((item) => {
    const entry = item && typeof item === "object" ? item : {};
    const rawFree = entry.free;
    const freeParsed = rawFree === undefined || rawFree === null || rawFree === "" ? 0 : parseNullableNumber(rawFree);
    const quantity = parseNullableNumber(entry.quantity);
    const mrp = parseNullableNumber(entry.mrp);
    const rate = parseNullableNumber(entry.rate);
    const gst = parseNullableNumber(entry.gst);
    const amount = parseNullableNumber(entry.amount);
    const taxableAmount = parseNullableNumber(entry.taxable_amount);

    return {
      medicine: normalizeMedicineName(entry.medicine) || null,
      manufacturer: safeString(entry.manufacturer, null),
      hsn: safeString(entry.hsn, null),
      pack: safeString(entry.pack, null),
      batch: safeString(entry.batch, null),
      expiry: normalizeInvoiceDate(entry.expiry),
      quantity,
      free: freeParsed,
      mrp,
      rate,
      gst,
      taxable_amount: taxableAmount,
      amount,
    };
  });

  const normalizedTotals = {
    subtotal: parseNullableNumber(totals.subtotal),
    tax: parseNullableNumber(totals.tax),
    grand_total: parseNullableNumber(totals.grand_total),
  };

  return {
    supplier: normalizedSupplier,
    invoice: normalizedInvoice,
    items: normalizedItems,
    totals: normalizedTotals,
  };
}

function validateOcrExtractionPayload(payload) {
  const sanitized = sanitizeOcrJson(payload);
  sanitized.supplier.gstin = validateGstin(sanitized.supplier.gstin);
  sanitized.invoice.date = normalizeInvoiceDate(sanitized.invoice.date);

  sanitized.items = sanitized.items.map((item) => {
    const nextItem = { ...item };
    nextItem.medicine = normalizeMedicineName(nextItem.medicine) || null;
    nextItem.manufacturer = safeString(nextItem.manufacturer, null);
    nextItem.hsn = safeString(nextItem.hsn, null);
    nextItem.pack = safeString(nextItem.pack, null);
    nextItem.batch = safeString(nextItem.batch, null);
    nextItem.expiry = normalizeInvoiceDate(nextItem.expiry);
    nextItem.quantity = parseNullableNumber(nextItem.quantity);
    nextItem.free = nextItem.free === null || nextItem.free === undefined ? 0 : parseNullableNumber(nextItem.free);
    nextItem.mrp = parseNullableNumber(nextItem.mrp);
    nextItem.rate = parseNullableNumber(nextItem.rate);
    nextItem.gst = parseNullableNumber(nextItem.gst);
    nextItem.taxable_amount = parseNullableNumber(nextItem.taxable_amount);
    nextItem.amount = parseNullableNumber(nextItem.amount);
    return nextItem;
  });

  sanitized.totals.subtotal = parseNullableNumber(sanitized.totals.subtotal);
  sanitized.totals.tax = parseNullableNumber(sanitized.totals.tax);
  sanitized.totals.grand_total = parseNullableNumber(sanitized.totals.grand_total);

  return sanitized;
}

function ensureImageIsSupported(file) {
  if (!file) return false;
  if (!OCR_ALLOWED_MIME_TYPES.includes(file.mimetype)) return false;
  if (file.size > MAX_IMAGE_BYTES) return false;
  return true;
}

function extractContentText(response) {
  const message = response?.choices?.[0]?.message;
  if (!message) return "";
  const content = message.content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || part?.content || "").join("\n");
  }
  if (typeof content === "string") {
    return content;
  }
  return "";
}

async function extractInvoiceFromOpenAI({ fileBuffer, mimeType }) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error("Missing invoice image data.");
  }

  if (!OCR_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error("Unsupported image type. Please upload a JPG, JPEG, PNG, or WEBP invoice.");
  }

  if (fileBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error("The invoice image is too large. Please upload a smaller image under 8 MB.");
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logOcr("openrouter configuration failed", { reason: "missing_api_key" });
    throw createOcrError("OCR is not configured. Please contact support.", { reason: "missing_api_key" });
  }

  const model = process.env.OPENROUTER_OCR_MODEL?.trim() || OCR_DEFAULT_MODEL;
  logOcr("openrouter request started", {
    model,
    mimeType,
    fileSize: fileBuffer.length,
  });

  const openrouter = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  const base64Image = fileBuffer.toString("base64");
  const imageUrl = `data:${mimeType};base64,${base64Image}`;

  const prompt = [
    "You are extracting a pharmaceutical supplier invoice from an image.",
    "Read only information visible in the invoice image.",
    "Never invent, guess, calculate, or assume a value that cannot be reliably read.",
    "If a value is unclear or missing, return null.",
    "Do not convert an unreadable value into 0.",
    "Do not guess batch numbers.",
    "Do not guess expiry dates.",
    "Do not guess quantities.",
    "Do not guess MRP.",
    "Do not guess purchase rate.",
    "Do not guess GST.",
    "Do not guess HSN.",
    "Preserve the exact visible medicine/product name as much as possible.",
    "Your output must be valid JSON that matches exactly this shape:",
    "{\n  \"supplier\": { \"name\": null, \"gstin\": null, \"address\": null, \"phone\": null },\n  \"invoice\": { \"number\": null, \"date\": null },\n  \"items\": [{ \"medicine\": null, \"manufacturer\": null, \"hsn\": null, \"pack\": null, \"batch\": null, \"expiry\": null, \"quantity\": null, \"free\": null, \"mrp\": null, \"rate\": null, \"gst\": null, \"taxable_amount\": null, \"amount\": null }],\n  \"totals\": { \"subtotal\": null, \"tax\": null, \"grand_total\": null }\n}",
    "Important: use null for unreadable values and do not use 0 unless the invoice clearly indicates no free quantity and a free column is present and blank.",
    "For Indian pharmaceutical supplier invoices, reliably detect supplier GSTIN, invoice number, invoice date, medicine names, manufacturer, HSN, pack, batch, expiry, quantity, free quantity, MRP, purchase rate, GST percentage, taxable amount, invoice totals, and supplier address/phone when visible.",
    "Handle varying table layouts, different column orders, multi-line medicine names, abbreviations, number formats, and fonts. Focus on visual understanding rather than fixed positions.",
    "Do not return markdown fences or commentary. Return JSON only.",
  ].join("\n");

  try {
    const completion = await openrouter.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 2400,
    });

    logOcr("openrouter response received", {
      model,
      responseId: completion?.id || null,
      contentLength: extractContentText(completion).length,
    });

    const rawContent = extractContentText(completion);
    if (!rawContent.trim()) {
      logOcr("openrouter response parsing failed", { reason: "empty_content" });
      throw createOcrError("Unable to process the invoice. Please try again.", { reason: "empty_content" });
    }

    let payload;
    try {
      payload = JSON.parse(rawContent);
    } catch (error) {
      logOcr("openrouter response parsing failed", {
        reason: "invalid_json",
        message: error.message,
      });
      throw createOcrError("Unable to process the invoice. Please try again.", { reason: "invalid_json" });
    }
    const validated = validateOcrExtractionPayload(payload);

    if (!Array.isArray(validated.items) || validated.items.length === 0) {
      logOcr("openrouter response parsing failed", { reason: "no_invoice_items" });
      throw createOcrError("Unable to process the invoice. Please try again.", { reason: "no_invoice_items" });
    }

    return validated;
  } catch (error) {
    if (error?.code === "OCR_FAILED") {
      throw error;
    }

    const safeError = getSafeOpenRouterError(error);
    logOcr("openrouter request failed", safeError);

    if (safeError.status === 401 || safeError.status === 403) {
      throw createOcrError("OCR service authentication failed. Please contact support.", safeError);
    }

    if (safeError.status === 429 || safeError.status >= 500) {
      throw createOcrError("OCR service is temporarily unavailable. Please try again in a moment.", safeError);
    }

    if (/image|vision|multimodal/i.test(safeError.message) && /support|accept|allow|capab|input|modal/i.test(safeError.message)) {
      throw createOcrError("The configured OCR model does not support image input. Please contact support.", { ...safeError, reason: "image_input_not_supported" });
    }

    if (safeError.code === "model_not_found" || /model/i.test(safeError.message) && /not found|does not exist|unsupported|invalid/i.test(safeError.message)) {
      throw createOcrError("OCR model configuration is invalid. Please contact support.", safeError);
    }

    throw createOcrError("Unable to process the invoice. Please try again.", safeError);
  }
}

module.exports = {
  OCR_ALLOWED_MIME_TYPES,
  MAX_IMAGE_BYTES,
  OCR_DEFAULT_MODEL,
  normalizeInvoiceDate,
  validateGstin,
  sanitizeOcrJson,
  validateOcrExtractionPayload,
  ensureImageIsSupported,
  extractInvoiceFromOpenAI,
};
