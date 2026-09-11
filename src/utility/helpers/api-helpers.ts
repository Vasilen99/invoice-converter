/**
 * API Helper Functions for Invoice Prefill Endpoint
 * Handles data transformation, normalization, and aggregation
 */

type ParsedLineItem = {
  description?: string;
  unit?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  vatPercent?: string | number;
};

type ParsedInvoiceData = {
  location?: string;
  bank?: string;
  iban?: string;
  bic?: string;
  lineItems?: ParsedLineItem[];
};

type LineItemTemplate = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatPercent: string;
};

type BankInfo = {
  bank: string;
  iban: string;
  bic: string;
};

/**
 * Parses and validates a JSON address object
 * @param value - Unknown value that should be an address object
 * @returns Parsed address or null if invalid
 */
export function parseJsonAddress(
  value: unknown,
): { settlement?: string; street?: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const address = value as Record<string, unknown>;
  return {
    settlement:
      typeof address.settlement === "string" ? address.settlement : undefined,
    street: typeof address.street === "string" ? address.street : undefined,
  };
}

/**
 * Converts a value to a number with fallback
 * Handles string normalization and parsing
 * @param value - Value to convert (string or number)
 * @param fallback - Default value if parsing fails
 * @returns Parsed number or fallback
 */
export function toNumber(
  value: string | number | undefined,
  fallback = 0,
): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value !== "string") return fallback;

  const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Safely trims a string value
 * @param value - Value to trim
 * @returns Trimmed string or empty string
 */
function safeStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Creates a unique key for line item templates
 * @param description - Item description
 * @param unitPrice - Unit price
 * @param vatPercent - VAT percentage
 * @returns Composite key string
 */
function createLineItemKey(
  description: string,
  unitPrice: string,
  vatPercent: string,
): string {
  return `${description}|${unitPrice}|${vatPercent}`;
}

/**
 * Creates a unique key for bank info
 * @param bank - Bank name
 * @param iban - IBAN number
 * @param bic - BIC code
 * @returns Composite key string
 */
function createBankKey(bank: string, iban: string, bic: string): string {
  return `${bank}|${iban}|${bic}`;
}

/**
 * Processes a single generated invoice's line items
 * Adds them to the line item template map if they don't already exist
 * @param lineItems - Line items from generated invoice
 * @param templateMap - Map to store/update templates
 */
function processGeneratedLineItems(
  lineItems: Array<{
    description: string | null;
    quantity: number | string;
    unitPrice: number | string;
    vatRate: number | string;
  }>,
  templateMap: Map<string, LineItemTemplate>,
): void {
  for (const lineItem of lineItems) {
    const description = safeStringValue(lineItem.description);
    if (!description) continue;

    const unitPrice = Number(lineItem.unitPrice).toFixed(2);
    const vatPercent = Number(lineItem.vatRate).toFixed(2);
    const key = createLineItemKey(description, unitPrice, vatPercent);

    if (!templateMap.has(key)) {
      templateMap.set(key, {
        description,
        unit: "бр.",
        quantity: Number(lineItem.quantity).toFixed(2),
        unitPrice,
        vatPercent,
      });
    }
  }
}

/**
 * Processes parsed line items from source documents
 * Adds them to the line item template map if they don't already exist
 * @param parsedLineItems - Line items from parsed data
 * @param templateMap - Map to store/update templates
 */
function processParsedLineItems(
  parsedLineItems: ParsedLineItem[],
  templateMap: Map<string, LineItemTemplate>,
): void {
  for (const parsedLineItem of parsedLineItems) {
    const description = safeStringValue(parsedLineItem.description);
    if (!description) continue;

    const unitPrice = toNumber(parsedLineItem.unitPrice).toFixed(2);
    const vatPercent = toNumber(parsedLineItem.vatPercent).toFixed(2);
    const key = createLineItemKey(description, unitPrice, vatPercent);

    if (!templateMap.has(key)) {
      templateMap.set(key, {
        description,
        unit: safeStringValue(parsedLineItem.unit) || "бр.",
        quantity: toNumber(parsedLineItem.quantity, 1).toFixed(2),
        unitPrice,
        vatPercent,
      });
    }
  }
}

/**
 * Aggregates prefill data from a collection of invoices
 * Performs single-pass iteration to collect:
 * - Line item templates
 * - Location options
 *
 * @param invoices - Array of generated invoices with related data
 * @returns Object containing aggregated templates and locations
 */
export function aggregateInvoicePrefillData(
  invoices: Array<{
    lineItems: Array<{
      description: string | null;
      quantity: number | string;
      unitPrice: number | string;
      vatRate: number | string;
    }>;
    sourceDocument: {
      parsedData: unknown;
    } | null;
  }>,
): {
  lineItemTemplates: LineItemTemplate[];
  locationOptions: string[];
} {
  const lineItemTemplateMap = new Map<string, LineItemTemplate>();
  const locationSet = new Set<string>();

  // Single pass through all invoices
  for (const invoice of invoices) {
    // Process generated line items
    processGeneratedLineItems(invoice.lineItems, lineItemTemplateMap);

    // Process parsed data
    const parsedData = invoice.sourceDocument
      ?.parsedData as ParsedInvoiceData | null;
    if (!parsedData) continue;

    // Process parsed line items
    if (parsedData.lineItems && Array.isArray(parsedData.lineItems)) {
      processParsedLineItems(parsedData.lineItems, lineItemTemplateMap);
    }

    // Process location
    const location = safeStringValue(parsedData.location);
    if (location) {
      locationSet.add(location);
    }
  }

  return {
    lineItemTemplates: Array.from(lineItemTemplateMap.values()),
    locationOptions: Array.from(locationSet),
  };
}

/**
 * Adds organization bank info to the bank options map if it exists
 * @param orgBank - Organization bank name
 * @param orgIban - Organization IBAN
 * @param orgBic - Organization BIC
 * @param bankMap - Map to store/update bank info
 */
export function addOrganizationBankInfo(
  orgBank: string | null | undefined,
  orgIban: string | null | undefined,
  orgBic: string | null | undefined,
  bankMap: Map<string, BankInfo>,
): void {
  const bank = safeStringValue(orgBank);
  const iban = safeStringValue(orgIban);
  const bic = safeStringValue(orgBic);

  if (bank || iban || bic) {
    const key = createBankKey(bank, iban, bic);
    bankMap.set(key, { bank, iban, bic });
  }
}

/**
 * Generates the next invoice number based on series prefix and current number
 * @param prefix - Invoice series prefix (e.g., "INV")
 * @param currentNumber - Current invoice number
 * @returns Formatted invoice number suggestion
 */
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

/**
 * Type for prefill response data
 */
export type PrefillData = {
  invoiceNumberSuggestion: string;
  organization: {
    id: number;
    name: string;
    bulstat: string | null;
    vatNumber: string | null;
    molName: string | null;
    address: { settlement?: string; street?: string } | null;
    bank: string | null;
    iban: string | null;
    bic: string | null;
    invoiceSeriesPrefix: string | null;
    current_inv_number: number | string | null;
  };
  contragent: {
    id: number;
    name: string;
    bulstat: string | null;
    vatNumber: string | null;
    molName: string | null;
    address: { settlement?: string; street?: string } | null;
  };
  lineItemTemplates: LineItemTemplate[];
  locationOptions: string[];
};

/**
 * Builds the complete prefill response data
 * @param organization - Organization data
 * @param contragent - Contragent data
 * @param aggregatedData - Aggregated invoice prefill data
 * @returns Complete prefill response
 */
export function buildPrefillResponse(
  organization: {
    id: number;
    name: string;
    bulstat: string | null;
    vatNumber: string | null;
    molName: string | null;
    address: unknown;
    bank: string | null;
    iban: string | null;
    bic: string | null;
    invoiceSeriesPrefix: string | null;
    current_inv_number: number | string | null;
  },
  contragent: {
    id: number;
    name: string;
    bulstat: string | null;
    vatNumber: string | null;
    molName: string | null;
    address: unknown;
  },
  aggregatedData: {
    lineItemTemplates: LineItemTemplate[];
    locationOptions: string[];
  },
): PrefillData {
  return {
    invoiceNumberSuggestion: generateNextInvoiceNumber(
      organization.invoiceSeriesPrefix,
      organization.current_inv_number,
    ),
    organization: {
      ...organization,
      address: parseJsonAddress(organization.address),
    },
    contragent: {
      ...contragent,
      address: parseJsonAddress(contragent.address),
    },
    lineItemTemplates: aggregatedData.lineItemTemplates,
    locationOptions: aggregatedData.locationOptions,
  };
}
