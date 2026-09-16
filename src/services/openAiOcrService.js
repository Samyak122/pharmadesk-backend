const OpenAI = require("openai");

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OCR_DEFAULT_MODEL = "openrouter/free";
const OPENROUTER_REQUEST_TIMEOUT_MS = 60 * 1000;
const OCR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = Number(process.env.OPENAI_OCR_MAX_BYTES || 8 * 1024 * 1024);
const OCR_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "pharmaceutical_supplier_invoice",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["supplier", "invoice", "items", "totals"],
      properties: {
        supplier: {
          type: "object",
          additionalProperties: false,
          required: ["name", "gstin", "address", "phone"],
          properties: {
            name: { type: ["string", "null"] },
            gstin: { type: ["string", "null"] },
            address: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
          },
        },
        invoice: {
          type: "object",
          additionalProperties: false,
          required: ["number", "date"],
          properties: {
            number: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
          },
        },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["medicine", "manufacturer", "hsn", "pack", "batch", "expiry", "quantity", "free", "mrp", "rate", "gst", "taxable_amount", "amount"],
            properties: {
              medicine: { type: ["string", "null"] },
              manufacturer: { type: ["string", "null"] },
              hsn: { type: ["string", "null"] },
              pack: { type: ["string", "null"] },
              batch: { type: ["string", "null"] },
              expiry: { type: ["string", "null"] },
              quantity: { type: ["number", "null"] },
              free: { type: ["number", "null"] },
              mrp: { type: ["number", "null"] },
              rate: { type: ["number", "null"] },
              gst: { type: ["number", "null"] },
              taxable_amount: { type: ["number", "null"] },
              amount: { type: ["number", "null"] },
            },
          },
        },
        totals: {
          type: "object",
          additionalProperties: false,
          required: ["subtotal", "tax", "grand_total"],
          properties: {
            subtotal: { type: ["number", "null"] },
            tax: { type: ["number", "null"] },
            grand_total: { type: ["number", "null"] },
          },
        },
      },
    },
  },
};

function logOcr(event, details = {}) {
  console.info(`[OCR] ${event}`, JSON.stringify(details));
}

function getSafeOpenRouterError(error) {
  const providerError = error?.response?.data?.error || error?.error || {};
  return {
    name: error?.name || "OpenRouterError",
    message: error?.message || "Unknown OpenRouter error",
    status: error?.status || error?.statusCode || error?.response?.status || null,
    code: error?.code || null,
    providerType: providerError?.type || null,
    providerCode: providerError?.code || null,
    providerMessage: providerError?.message || null,
  };
}

function isRequestTimeout(error, safeError) {
  return error?.name === "TimeoutError"
    || error?.code === "ETIMEDOUT"
    || error?.code === "ECONNABORTED"
    || safeError.status === 408
    || /timeout|timed out/i.test(safeError.message);
}

function isNetworkError(error, safeError) {
  return !safeError.status
    && ["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ENETUNREACH"].includes(error?.code)
    || (!safeError.status && /network|dns|getaddrinfo|socket|connect/i.test(safeError.message));
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

function safeResponsePreview(content) {
  return String(content || "")
    .replace(/data:[^\s"']+/gi, "[data-url-redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[api-key-redacted]")
    .slice(0, 240);
}

function extractJsonObjectText(content) {
  const source = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = source.indexOf("{");
  if (start < 0) return source;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
}

function parseOcrJsonContent(content) {
  return JSON.parse(extractJsonObjectText(content));
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
      timeout: OPENROUTER_REQUEST_TIMEOUT_MS,
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
      logOcr("openrouter response parsing failed", {
        reason: "empty_content",
        contentLength: 0,
        finishReason: completion?.choices?.[0]?.finish_reason || null,
      });
      throw createOcrError("Unable to process the invoice. Please try again.", { reason: "empty_content" });
    }

    let payload;
    try {
      payload = parseOcrJsonContent(rawContent);
    } catch (error) {
      logOcr("openrouter response parsing failed", {
        reason: "invalid_json",
        message: error.message,
        contentLength: rawContent.length,
        finishReason: completion?.choices?.[0]?.finish_reason || null,
        firstSafePortion: safeResponsePreview(rawContent),
        lastSafePortion: safeResponsePreview(rawContent.slice(-240)),
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
    if (isRequestTimeout(error, safeError)) {
      logOcr("openrouter request timeout", safeError);
      throw createOcrError("Unable to process the invoice. Please try again.", { ...safeError, reason: "timeout" });
    }

    const statusEvents = {
      401: "openrouter authentication error",
      402: "openrouter payment error",
      403: "openrouter forbidden error",
      408: "openrouter request timeout",
      429: "openrouter rate limit error",
    };
    const event = statusEvents[safeError.status]
      || (safeError.status >= 500 ? "openrouter provider error" : null)
      || (isNetworkError(error, safeError) ? "openrouter network error" : "openrouter request failed");
    logOcr(event, safeError);

    if ([401, 402, 403, 408, 429].includes(safeError.status) || safeError.status >= 500 || isNetworkError(error, safeError)) {
      throw createOcrError("Unable to process the invoice. Please try again.", safeError);
    }

    if (/image|vision|multimodal/i.test(safeError.message) && /support|accept|allow|capab|input|modal/i.test(safeError.message)) {
      throw createOcrError("Unable to process the invoice. Please try again.", { ...safeError, reason: "image_input_not_supported" });
    }

    if (safeError.code === "model_not_found" || /model/i.test(safeError.message) && /not found|does not exist|unsupported|invalid/i.test(safeError.message)) {
      throw createOcrError("Unable to process the invoice. Please try again.", safeError);
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
  extractJsonObjectText,
  parseOcrJsonContent,
  ensureImageIsSupported,
  extractInvoiceFromOpenAI,
};
