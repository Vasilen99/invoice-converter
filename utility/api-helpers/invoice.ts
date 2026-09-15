import { getTodayForInput } from "@/utility/date-formatter";
import {
  DEFAULT_CURRENCY,
  DEFAULT_INVOICE_NUMBER,
  DEFAULT_UNIT,
  DEFAULT_VAT_PERCENT,
} from "@/utility/constants";
import { normalizeEik, normalizeText, parseDecimal, toMoney } from "./common";
import type { BulgarianInvoiceData } from "@/types";

const PATCH_FIELDS = [
  "invoiceNumber",
  "invoiceDate",
  "taxEventDate",
  "location",
  "sellerName",
  "sellerEik",
  "sellerVatNumber",
  "sellerCity",
  "sellerAddress",
  "sellerMol",
  "buyerName",
  "buyerEik",
  "buyerVatNumber",
  "buyerCity",
  "buyerAddress",
  "buyerMol",
  "subtotal",
  "vatAmount",
  "total",
  "totalInWords",
  "currency",
  "bank",
  "iban",
  "bic",
] as const;

export function formatInvoiceNumber(value: unknown): string {
  const digitsOnly = normalizeText(value).replace(/\D/g, "");
  if (!digitsOnly) return DEFAULT_INVOICE_NUMBER;
  return digitsOnly.padStart(10, "0");
}

export function parseInvoiceNumber(
  invoiceNumber: string,
  defaultSeries: string,
): { series: string; seq: number } {
  const trimmed = normalizeText(invoiceNumber);

  const match = trimmed.match(/^([A-Za-zА-Яа-яЁё]+)[-\s]?(\d+)$/u);
  if (match) {
    return { series: match[1].toUpperCase(), seq: parseInt(match[2], 10) };
  }

  const numOnly = parseInt(trimmed.replace(/\D/g, ""), 10);
  return {
    series: defaultSeries || "INV",
    seq: isNaN(numOnly) || numOnly <= 0 ? 1 : numOnly,
  };
}

export function generateNextInvoiceNumber(
  prefix: string | null | undefined,
  currentNumber: number | string | null | undefined,
): string {
  const invoiceSeries = prefix || "INV";
  const current =
    typeof currentNumber === "string"
      ? Number(currentNumber)
      : (currentNumber ?? 0);
  const nextNumber = Math.max(current + 1, 1);
  return `${invoiceSeries}${String(nextNumber).padStart(10, "0")}`;
}

export function recalculateTotals(
  lineItems: BulgarianInvoiceData["lineItems"],
): {
  lineItems: BulgarianInvoiceData["lineItems"];
  subtotal: string;
  vatAmount: string;
  total: string;
} {
  const normalizedItems = (lineItems ?? []).map((item) => {
    const quantity = parseDecimal(item.quantity);
    const unitPrice = parseDecimal(item.unitPrice);
    const vatPercent = parseDecimal(item.vatPercent || DEFAULT_VAT_PERCENT);
    const value = quantity * unitPrice;
    return {
      description: normalizeText(item.description),
      unit: normalizeText(item.unit) || DEFAULT_UNIT,
      quantity: normalizeText(item.quantity) || "1",
      unitPrice: normalizeText(item.unitPrice) || "0.00",
      vatPercent: normalizeText(item.vatPercent) || DEFAULT_VAT_PERCENT,
      value: toMoney(value),
      _vatPercentNumber: vatPercent,
      _valueNumber: value,
    };
  });

  const subtotalNumber = normalizedItems.reduce(
    (sum: number, item) => sum + item._valueNumber,
    0,
  );
  const vatNumber = normalizedItems.reduce(
    (sum: number, item) =>
      sum + item._valueNumber * (item._vatPercentNumber / 100),
    0,
  );

  return {
    lineItems: normalizedItems.map(
      ({ _valueNumber, _vatPercentNumber, ...rest }) => rest,
    ),
    subtotal: toMoney(subtotalNumber),
    vatAmount: toMoney(vatNumber),
    total: toMoney(subtotalNumber + vatNumber),
  };
}

export function createBaseInvoice(
  composerName?: string | null,
): BulgarianInvoiceData {
  const today = getTodayForInput();
  const seedLineItems: BulgarianInvoiceData["lineItems"] = [
    {
      description: "Услуга",
      unit: DEFAULT_UNIT,
      quantity: "1",
      unitPrice: "0.00",
      vatPercent: DEFAULT_VAT_PERCENT,
      value: "0.00",
    },
  ];
  const totals = recalculateTotals(seedLineItems);
  return {
    invoiceNumber: DEFAULT_INVOICE_NUMBER,
    invoiceDate: today,
    taxEventDate: today,
    location: "",
    sellerName: "",
    sellerEik: "",
    sellerVatNumber: "",
    sellerCity: "",
    sellerAddress: "",
    sellerMol: "",
    buyerName: "",
    buyerEik: "",
    buyerVatNumber: "",
    buyerCity: "",
    buyerAddress: "",
    buyerMol: "",
    lineItems: totals.lineItems,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
    totalInWords: "",
    currency: DEFAULT_CURRENCY,
    composer_name: normalizeText(composerName),
    bank: "",
    iban: "",
    bic: "",
  };
}

export function sanitizeLineItems(
  lineItems: unknown,
): BulgarianInvoiceData["lineItems"] | null {
  if (!Array.isArray(lineItems)) return null;
  const sanitized = lineItems
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const v = item as Record<string, unknown>;
      return {
        description: normalizeText(v.description),
        unit: normalizeText(v.unit) || DEFAULT_UNIT,
        quantity: normalizeText(v.quantity) || "1",
        unitPrice: normalizeText(v.unitPrice) || "0.00",
        vatPercent: normalizeText(v.vatPercent) || DEFAULT_VAT_PERCENT,
        value: normalizeText(v.value),
      };
    });
  return sanitized.length ? sanitized : [];
}

export function sanitizeInvoicePatch(
  patch: Partial<BulgarianInvoiceData> & {
    lineItems?: BulgarianInvoiceData["lineItems"];
  },
): Partial<BulgarianInvoiceData> {
  const sanitized: Partial<BulgarianInvoiceData> = {};
  for (const field of PATCH_FIELDS) {
    if (field in patch) {
      (sanitized as Record<string, string>)[field] = normalizeText(
        patch[field],
      );
    }
  }
  const lineItems = sanitizeLineItems(patch.lineItems);
  if (lineItems) sanitized.lineItems = lineItems;
  if (sanitized.sellerEik)
    sanitized.sellerEik = normalizeEik(sanitized.sellerEik);
  if (sanitized.buyerEik) sanitized.buyerEik = normalizeEik(sanitized.buyerEik);
  return sanitized;
}

export function sanitizeEditPatch(
  patch: Partial<BulgarianInvoiceData> & {
    lineItems?: BulgarianInvoiceData["lineItems"];
  },
): Partial<BulgarianInvoiceData> {
  const sanitized: Partial<BulgarianInvoiceData> = {};
  for (const field of PATCH_FIELDS) {
    if (field in patch) {
      const val = normalizeText(patch[field]);
      if (val) (sanitized as Record<string, string>)[field] = val;
    }
  }
  const lineItems = sanitizeLineItems(patch.lineItems);
  if (lineItems && lineItems.length > 0) sanitized.lineItems = lineItems;
  if (sanitized.sellerEik)
    sanitized.sellerEik = normalizeEik(sanitized.sellerEik);
  if (sanitized.buyerEik) sanitized.buyerEik = normalizeEik(sanitized.buyerEik);
  return sanitized;
}

export function sanitizeInvoice(
  invoice: BulgarianInvoiceData,
): BulgarianInvoiceData {
  const patch = sanitizeInvoicePatch(invoice);
  const base = createBaseInvoice(invoice.composer_name);
  const merged = {
    ...base,
    ...patch,
    lineItems: patch.lineItems ?? base.lineItems,
  } as BulgarianInvoiceData;
  const totals = recalculateTotals(merged.lineItems);
  const today = getTodayForInput();

  return {
    ...merged,
    lineItems: totals.lineItems,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
    totalInWords: normalizeText(merged.totalInWords),
    invoiceNumber:
      normalizeText(merged.invoiceNumber) || DEFAULT_INVOICE_NUMBER,
    invoiceDate: normalizeText(merged.invoiceDate) || today,
    taxEventDate: normalizeText(merged.taxEventDate) || today,
    currency: normalizeText(merged.currency) || DEFAULT_CURRENCY,
  };
}

export function mergeInvoice(
  current: BulgarianInvoiceData,
  patch: Partial<BulgarianInvoiceData>,
): BulgarianInvoiceData {
  const merged = {
    ...current,
    ...patch,
    lineItems: patch.lineItems ?? current.lineItems,
  };
  const totals = recalculateTotals(merged.lineItems);
  return sanitizeInvoice({
    ...merged,
    lineItems: totals.lineItems,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
  });
}

export function hasRequiredInvoiceFields(
  invoice: BulgarianInvoiceData | null | undefined,
): boolean {
  if (!invoice) return false;

  const hasSeller =
    Boolean(normalizeText(invoice.sellerName)) &&
    Boolean(normalizeEik(invoice.sellerEik));
  const hasBuyer =
    Boolean(normalizeText(invoice.buyerName)) &&
    Boolean(normalizeEik(invoice.buyerEik));
  const hasLineItems =
    Array.isArray(invoice.lineItems) &&
    invoice.lineItems.some((item) => Boolean(normalizeText(item.description)));

  return hasSeller && hasBuyer && hasLineItems;
}
