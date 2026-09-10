const Medicine = require("../models/Medicine");
const Supplier = require("../models/Supplier");
const purchaseService = require("./purchaseService");

const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

function stripNoise(value) {
  return String(value ?? "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMedicineName(value) {
  return stripNoise(value)
    .replace(/[^A-Za-z0-9%/().,\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberFrom(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExpiry(value) {
  if (!value && value !== 0) return "";
  const text = String(value).trim();
  const compact = text.replace(/\s+/g, "").replace(/\//g, "-");

  const monthYearMatch = compact.match(/^(\d{4})[-](\d{1,2})$/i)
    || compact.match(/^(\d{1,2})[-](\d{4})$/i)
    || compact.match(/^(\d{4})\s*(\d{2})$/i)
    || compact.match(/^(\d{2})\s*(\d{4})$/i);

  if (monthYearMatch) {
    const first = monthYearMatch[1];
    const second = monthYearMatch[2];
    const year = first.length === 4 ? first : second;
    const month = (first.length === 4 ? second : first).padStart(2, "0");
    return `${year}-${month}`;
  }

  const fullDateMatch = compact.match(/^(\d{4})[-](\d{1,2})[-](\d{1,2})$/i)
    || compact.match(/^(\d{1,2})[-](\d{1,2})[-](\d{4})$/i);

  if (fullDateMatch) {
    const a = fullDateMatch[1];
    const b = fullDateMatch[2];
    const c = fullDateMatch[3];
    const year = a.length === 4 ? a : c;
    const month = a.length === 4 ? b : a;
    const day = a.length === 4 ? c : b;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return text;
}

function normalizeBatch(value) {
  return stripNoise(value).replace(/\s+/g, " ").trim();
}

function isLikelyHeaderRow(line) {
  const text = stripNoise(line).toLowerCase();
  return /(medicine|batch|expiry|qty|mrp|rate|gst|hsn)/i.test(text) && /(?:medicine|batch|expiry|qty)/i.test(text);
}

function isLikelyTotalLine(line) {
  const text = stripNoise(line).toLowerCase();
  return /(total|grand total|amount|gst|cgst|sgst|discount|paid|balance)/i.test(text) && /\d/.test(text);
}

function parseSupplierInfo(lines) {
  const supplier = {
    name: "",
    gstin: "",
    invoice_number: "",
    invoice_date: "",
  };

  const block = lines.join(" ");
  const gstinMatch = block.match(/gstin\s*[:#-]?\s*([A-Z0-9]{10,20})/i)
    || block.match(/\b([A-Z0-9]{15})\b/);
  if (gstinMatch) supplier.gstin = gstinMatch[1].toUpperCase();

  const invoiceNumberMatch = block.match(/invoice\s*(?:no|number)?\s*[:#-]?\s*([A-Z0-9\-/]+)\b/i)
    || block.match(/bill\s*(?:no|number)?\s*[:#-]?\s*([A-Z0-9\-/]+)\b/i);
  if (invoiceNumberMatch) supplier.invoice_number = invoiceNumberMatch[1].trim();

  const invoiceDateMatch = block.match(/invoice\s*date\s*[:#-]?\s*([0-9]{2}[/-][0-9]{2}[/-][0-9]{2,4}|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2})/i)
    || block.match(/date\s*[:#-]?\s*([0-9]{2}[/-][0-9]{2}[/-][0-9]{2,4}|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2})/i);
  if (invoiceDateMatch) supplier.invoice_date = normalizeExpiry(invoiceDateMatch[1]);

  const supplierLine = lines.find((line) => {
    const text = stripNoise(line);
    return text && !/[0-9]{2,4}[-/][0-9]{1,2}[-/][0-9]{1,2}/.test(text) && !isLikelyHeaderRow(text) && !isLikelyTotalLine(text) && /[A-Za-z]/.test(text) && text.length > 3 && !/^gstin/i.test(text) && !/^invoice/i.test(text);
  });
  if (supplierLine) supplier.name = stripNoise(supplierLine).replace(/\s*(gstin|invoice).*$/i, "").trim();

  return supplier;
}

function matchRowCandidate(line) {
  const cleaned = stripNoise(line).replace(/\s*\|\s*/g, " ");
  if (!cleaned || cleaned.length < 8) return null;
  if (isLikelyHeaderRow(cleaned) || isLikelyTotalLine(cleaned)) return null;

  const patterns = [
    /^(.+?)\s+([A-Za-z0-9\-/.]+)\s+(\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|\d{2}[-/]\d{2})\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(\d{4,8})?$/i,
    /^(.+?)\s+([A-Za-z0-9\-/.]+)\s+(\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|\d{2}[-/]\d{2})\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(\d{4,8})?$/i,
    /^(.+?)\s+([A-Za-z0-9\-/.]+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(\d{4,8})?$/i,
    /^(.+?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(\d{4,8})?$/i,
    /^(.+?)\s+(\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|\d{2}[-/]\d{2})\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(\d{4,8})?$/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match) continue;

    const medicineNameCandidate = match[1] || "";
    const medicineName = normalizeMedicineName(medicineNameCandidate);
    const batchToken = match[2] || "";
    const expiryRaw = match[3] || "";
    let batchNumber = normalizeBatch(batchToken);
    let expiryDate = normalizeExpiry(expiryRaw || "");

    const quantity = numberFrom(match[4] || match[3] || match[2]);
    const mrp = numberFrom(match[5] || match[4] || match[3]);
    const purchaseRate = numberFrom(match[6] || match[5] || match[4]);
    const gst = numberFrom(match[7] || match[6] || match[5]);
    const hsn = match[8] ? String(match[8]).trim() : "";

    if (!medicineName || quantity === null || mrp === null || purchaseRate === null) {
      continue;
    }

    if (batchNumber && !/[0-9]/.test(batchNumber) && !/[\-/]/.test(batchNumber)) {
      batchNumber = "";
    }

    if (batchNumber && /^\d+$/.test(batchNumber)) {
      batchNumber = "";
    }

    if (!expiryDate && /\d{4}[-/]\d{1,2}/.test(cleaned)) {
      const dateLike = cleaned.match(/(\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|\d{2}[-/]\d{2})/);
      if (dateLike) expiryDate = normalizeExpiry(dateLike[1]);
    }

    if (expiryDate && !/\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/.test(expiryDate) && !/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(expiryDate) && !/^\d{4}-\d{2}$/.test(expiryDate)) {
      expiryDate = "";
    }

    return {
      medicine_name: medicineName,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      quantity,
      mrp,
      purchase_rate: purchaseRate,
      gst_percentage: gst ?? 0,
      hsn,
    };
  }

  const numericMatches = [...cleaned.matchAll(/\d+(?:\.\d+)?/g)].map((match) => numberFrom(match[0]));
  const hasEnoughNumbers = numericMatches.length >= 4 && !/(\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|\d{2}[-/]\d{2})/.test(cleaned);

  if (hasEnoughNumbers) {
    const parts = cleaned.split(/\s+/);
    const numberIndexes = parts
      .map((part, index) => (part.match(/^\d+(?:\.\d+)?$/) ? index : -1))
      .filter((index) => index >= 0);

    if (numberIndexes.length >= 4) {
      const medicineEndIndex = numberIndexes[numberIndexes.length - 4];
      const medicineName = normalizeMedicineName(parts.slice(0, medicineEndIndex).join(" "));
      const quantity = numberFrom(parts[numberIndexes[numberIndexes.length - 4]]);
      const mrp = numberFrom(parts[numberIndexes[numberIndexes.length - 3]]);
      const purchaseRate = numberFrom(parts[numberIndexes[numberIndexes.length - 2]]);
      const gst = numberFrom(parts[numberIndexes[numberIndexes.length - 1]]);

      if (medicineName && quantity !== null && mrp !== null && purchaseRate !== null) {
        return {
          medicine_name: medicineName,
          batch_number: "",
          expiry_date: "",
          quantity,
          mrp,
          purchase_rate: purchaseRate,
          gst_percentage: gst ?? 0,
          hsn: "",
        };
      }
    }
  }

  return null;
}

function calculateConfidence(row) {
  let score = 0.65;
  if (row.medicine_name && row.medicine_name.length > 2) score += 0.12;
  if (row.batch_number) score += 0.08;
  if (row.expiry_date) score += 0.08;
  if (row.quantity !== null && row.quantity > 0) score += 0.06;
  if (row.mrp && row.mrp > 0) score += 0.05;
  if (row.purchase_rate && row.purchase_rate > 0) score += 0.05;
  if (row.gst_percentage !== null && row.gst_percentage >= 0) score += 0.03;
  if (row.hsn) score += 0.04;
  return Math.min(0.99, Number(score.toFixed(2)));
}

function validateSupplierInvoiceRow(row) {
  const errors = {
    quantity: [],
    mrp: [],
    purchase_rate: [],
    gst_percentage: [],
    expiry_date: [],
    batch_number: [],
    medicine_name: [],
  };

  const cleaned = {
    medicine_name: normalizeMedicineName(row.medicine_name || ""),
    batch_number: normalizeBatch(row.batch_number || ""),
    expiry_date: normalizeExpiry(row.expiry_date || ""),
    quantity: Number(row.quantity),
    mrp: Number(row.mrp),
    purchase_rate: Number(row.purchase_rate),
    gst_percentage: Number(row.gst_percentage),
    hsn: stripNoise(row.hsn || ""),
  };

  if (!cleaned.medicine_name) {
    errors.medicine_name.push("Medicine name is missing.");
  }

  if (!cleaned.batch_number) {
    errors.batch_number.push("Batch number is missing.");
  }

  if (!cleaned.expiry_date || !/^(\d{4}-\d{2}|\d{4}-\d{2}-\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{1,2}[-/]\d{4})$/.test(cleaned.expiry_date)) {
    errors.expiry_date.push("Expiry date is missing or not in a valid date format.");
  }

  if (!Number.isFinite(cleaned.quantity) || cleaned.quantity <= 0) {
    errors.quantity.push("Quantity must be a valid positive number.");
  }

  if (!Number.isFinite(cleaned.mrp) || cleaned.mrp <= 0) {
    errors.mrp.push("MRP must be greater than zero.");
  }

  if (!Number.isFinite(cleaned.purchase_rate) || cleaned.purchase_rate <= 0) {
    errors.purchase_rate.push("Purchase rate must be greater than zero.");
  }

  if (cleaned.gst_percentage !== null && cleaned.gst_percentage !== undefined && Number.isFinite(cleaned.gst_percentage) && (cleaned.gst_percentage < 0 || cleaned.gst_percentage > 100)) {
    errors.gst_percentage.push("GST percentage should be between 0 and 100.");
  }

  const valid = Object.values(errors).every((fieldErrors) => fieldErrors.length === 0);
  const confidence = calculateConfidence(cleaned);
  const issueList = Object.entries(errors)
    .filter(([, fieldErrors]) => fieldErrors.length > 0)
    .map(([fieldName, fieldErrors]) => `${fieldName.replace(/_/g, ' ')}: ${fieldErrors.join(' ')}`);

  return {
    valid,
    errors,
    normalized: cleaned,
    confidence,
    message: valid
      ? "Row passed validation."
      : `Row needs pharmacist review before import. ${issueList.join(' | ')}`,
  };
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function normalizeForSimilarity(value) {
  return normalizeMedicineName(value)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function similarityScore(source, target) {
  const left = normalizeForSimilarity(source);
  const right = normalizeForSimilarity(target);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLength = Math.max(left.length, right.length);
  if (!maxLength) return 0;
  return 1 - levenshtein(left, right) / maxLength;
}

function findMedicineMatch(medicineName, catalog = []) {
  const input = normalizeMedicineName(medicineName);
  if (!input) {
    return { matched: false, suggestion: "", similarity: 0 };
  }

  let bestMatch = null;
  for (const item of catalog) {
    const candidate = String(item?.medicine_name || "");
    const score = similarityScore(input, candidate);
    if (score > (bestMatch?.score || 0)) {
      bestMatch = { score, medicine_name: candidate };
    }
  }

  if (!bestMatch || bestMatch.score < 0.72) {
    return { matched: false, suggestion: "", similarity: bestMatch?.score || 0 };
  }

  return {
    matched: true,
    suggestion: bestMatch.medicine_name,
    similarity: Number(bestMatch.score.toFixed(3)),
  };
}

function extractSupplierInvoiceData(rawText, catalog = []) {
  const text = stripNoise(rawText || "");
  const quality_ok = text.length >= 80 && /[A-Za-z]/.test(text);
  const warning = quality_ok ? "" : "Image quality is too low to reliably read the invoice. Please take a clearer photo with the complete bill visible.";

  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => stripNoise(line))
    .filter((line) => line && !isLikelyTotalLine(line));

  const supplier = parseSupplierInfo(lines);
  const items = [];
  const seenKeys = new Set();

  for (const line of lines) {
    const candidate = matchRowCandidate(line);
    if (!candidate) continue;

    const validation = validateSupplierInvoiceRow(candidate);
    const catalogMatch = findMedicineMatch(candidate.medicine_name, catalog);
    const item = {
      ...candidate,
      validation,
      confidence: {
        medicine_name: { value: candidate.medicine_name, confidence: validation.confidence },
        batch_number: { value: candidate.batch_number, confidence: validation.confidence },
        expiry_date: { value: candidate.expiry_date, confidence: validation.confidence },
        quantity: { value: candidate.quantity, confidence: validation.confidence },
        mrp: { value: candidate.mrp, confidence: validation.confidence },
        purchase_rate: { value: candidate.purchase_rate, confidence: validation.confidence },
        gst_percentage: { value: candidate.gst_percentage, confidence: validation.confidence },
        hsn: { value: candidate.hsn, confidence: validation.confidence },
      },
      possible_match: catalogMatch.matched ? catalogMatch.suggestion : "",
      catalog_match: catalogMatch,
      review_required: !validation.valid || validation.confidence < DEFAULT_CONFIDENCE_THRESHOLD,
    };

    const key = `${candidate.medicine_name}|${candidate.batch_number}|${candidate.expiry_date}|${candidate.quantity}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      items.push(item);
    }
  }

  return {
    supplier,
    items,
    quality_ok,
    warning,
    threshold: DEFAULT_CONFIDENCE_THRESHOLD,
  };
}

async function findOrCreateMedicineFromName(medicineName) {
  const trimmedName = normalizeMedicineName(medicineName || "");
  if (!trimmedName) {
    throw new Error("Medicine name is required to create a purchase item.");
  }

  const medicine = await Medicine.findOne({
    where: { medicine_name: trimmedName },
  });

  if (medicine) return medicine;

  const created = await Medicine.create({
    medicine_name: trimmedName,
  });

  return created;
}

async function confirmSupplierInvoiceExtraction(payload, pharmacyId) {
  const { supplier = {}, items = [] } = payload || {};
  if (!pharmacyId) {
    throw new Error("Authentication is required to confirm an OCR invoice import.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No medicine items were detected in the supplier invoice.");
  }

  const supplierId = supplier.supplier_id ? Number(supplier.supplier_id) : null;
  let resolvedSupplierId = supplierId;

  if (supplier.name && !supplierId) {
    const existingSupplier = await Supplier.findOne({
      where: {
        pharmacy_id: pharmacyId,
        supplier_name: supplier.name,
      },
    });

    if (existingSupplier) {
      resolvedSupplierId = existingSupplier.supplier_id;
    } else {
      const created = await Supplier.create({
        supplier_name: supplier.name,
        gst_number: supplier.gstin || null,
        phone: supplier.phone || null,
        email: null,
        address: supplier.address || null,
        pharmacy_id: pharmacyId,
        is_active: true,
      });
      resolvedSupplierId = created.supplier_id;
    }
  }

  const purchaseItems = [];
  for (const item of items) {
    const row = item.normalized || item;
    const medicine_name = normalizeMedicineName(row.medicine_name || item.medicine_name || "");
    if (!medicine_name) continue;

    const batch_no = normalizeBatch(row.batch_number || item.batch_number || "");
    const expiry_date = normalizeExpiry(row.expiry_date || item.expiry_date || "");
    const quantity = Number(row.quantity ?? item.quantity ?? 0);
    const free_quantity = Number(row.free_quantity ?? item.free_quantity ?? 0);
    const unit_cost = Number(row.purchase_rate ?? item.purchase_rate ?? 0);
    const selling_price = Number(row.mrp ?? item.mrp ?? 0);
    const gst_percentage = Number(row.gst_percentage ?? item.gst_percentage ?? 0);

    if (!batch_no) {
      throw new Error(`Row for ${medicine_name} is missing a batch number.`);
    }
    if (!expiry_date || Number.isNaN(new Date(expiry_date).getTime())) {
      throw new Error(`Row for ${medicine_name} has an invalid expiry date.`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Row for ${medicine_name} has an invalid quantity.`);
    }
    if (!Number.isFinite(free_quantity) || free_quantity < 0) {
      throw new Error(`Row for ${medicine_name} has an invalid free quantity.`);
    }
    if (!Number.isFinite(unit_cost) || unit_cost <= 0) {
      throw new Error(`Row for ${medicine_name} has an invalid purchase rate.`);
    }
    if (!Number.isFinite(selling_price) || selling_price <= 0) {
      throw new Error(`Row for ${medicine_name} has an invalid MRP.`);
    }
    if (!Number.isFinite(gst_percentage) || gst_percentage < 0 || gst_percentage > 100) {
      throw new Error(`Row for ${medicine_name} has an invalid GST percentage.`);
    }

    let medicine = null;
    if (item.medicine_id) {
      medicine = await Medicine.findByPk(Number(item.medicine_id));
    }

    if (!medicine) {
      medicine = await Medicine.findOne({
        where: { medicine_name: medicine_name },
      });
    }

    if (!medicine) {
      medicine = await findOrCreateMedicineFromName(medicine_name);
    }

    const existingInventoryBatch = await require("../models/Inventory").findOne({
      where: {
        pharmacy_id: pharmacyId,
        medicine_id: medicine.medicine_id,
        batch_no,
        is_active: true,
      },
    });

    purchaseItems.push({
      medicine_id: medicine.medicine_id,
      batch_no,
      expiry_date,
      quantity,
      unit_cost,
      selling_price,
      min_stock: 5,
      location: "",
      inventory_batch: existingInventoryBatch,
    });
  }

  if (purchaseItems.length === 0) {
    throw new Error("No valid medicine rows are available to create a purchase.");
  }

  const result = await purchaseService.createPurchase({
    supplier_id: resolvedSupplierId,
    invoice_no: supplier.invoice_number || supplier.invoice?.number || `OCR-${Date.now()}`,
    notes: supplier.name ? `OCR import from supplier invoice: ${supplier.name}` : "OCR import from supplier invoice",
    payment_status: "Pending",
    items: purchaseItems,
  }, pharmacyId);

  return {
    supplier: { ...supplier, supplier_id: resolvedSupplierId },
    purchase: result,
    imported_count: purchaseItems.length,
  };
}

module.exports = {
  DEFAULT_CONFIDENCE_THRESHOLD,
  extractSupplierInvoiceData,
  validateSupplierInvoiceRow,
  findMedicineMatch,
  confirmSupplierInvoiceExtraction,
};
