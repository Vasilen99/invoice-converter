/**
 * API Helper Functions for Invoice Prefill Endpoint
 * Handles data transformation, normalization, and aggregation
 */

import {
  createBaseInvoice,
  formatInvoiceNumber,
  generateNextInvoiceNumber,
  hasRequiredInvoiceFields,
  mergeInvoice,
  parseInvoiceNumber,
  recalculateTotals,
  sanitizeEditPatch,
  sanitizeInvoice,
  sanitizeInvoicePatch,
} from "./invoice";
import { parseDecimal, parseJsonAddress } from "./common";
import type {
  ParsedInvoiceData,
  ParsedLineItem,
  LineItemTemplate,
} from "../types/parsed";

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

    const unitPrice = parseDecimal(parsedLineItem.unitPrice).toFixed(2);
    const vatPercent = parseDecimal(parsedLineItem.vatPercent).toFixed(2);
    const key = createLineItemKey(description, unitPrice, vatPercent);

    if (!templateMap.has(key)) {
      templateMap.set(key, {
        description,
        unit: safeStringValue(parsedLineItem.unit) || "бр.",
        quantity: parseDecimal(parsedLineItem.quantity, 1).toFixed(2),
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

export {
  createBaseInvoice,
  formatInvoiceNumber,
  generateNextInvoiceNumber,
  hasRequiredInvoiceFields,
  mergeInvoice,
  parseJsonAddress,
  parseInvoiceNumber,
  recalculateTotals,
  sanitizeEditPatch,
  sanitizeInvoice,
  sanitizeInvoicePatch,
};

export async function getFilePageCount(file: File): Promise<number | null> {
  try {
    const { parseOffice } = await import("officeparser");
    const bytes = await file.arrayBuffer();

    const buffer = Buffer.from(bytes);

    // Determine file type from file extension as hint for parseOffice
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const fileType: "pdf" | "docx" | "pptx" | null =
      fileExtension === "pdf"
        ? "pdf"
        : fileExtension === "docx"
          ? "docx"
          : fileExtension === "pptx"
            ? "pptx"
            : null;

    const ast = await parseOffice(buffer, { fileType });

    // For PDF files, count page nodes in content
    if (ast.type === "pdf") {
      const pageNodes = ast.content.filter((node) => node.type === "page");
      return pageNodes.length > 0 ? pageNodes.length : null;
    }

    // For DOCX and other formats, check metadata first
    if (ast.metadata.pages && typeof ast.metadata.pages === "number") {
      return ast.metadata.pages;
    }

    // For DOCX, estimate pages based on content length and break nodes
    if (ast.type === "docx") {
      // Count break nodes (page breaks)
      const breakNodes = ast.content.filter((node) => node.type === "break");

      // If there are explicit page breaks, pages = breaks + 1
      if (breakNodes.length > 0) {
        const pageCount = breakNodes.length + 1;
        return pageCount;
      }

      // Fallback: estimate based on total text content length
      // Count paragraphs and tables as rough page estimators
      const paragraphs = ast.content.filter(
        (node) => node.type === "paragraph",
      );
      const tables = ast.content.filter((node) => node.type === "table");

      // Estimate: roughly 40-50 paragraphs per page, tables add 1-2 pages each
      const estimatedPagesFromStructure = Math.max(
        1,
        Math.ceil(paragraphs.length / 40) +
          (tables.length > 0 ? tables.length : 0),
      );

      // Also try character-based estimation
      const totalTextLength = ast.content.reduce((acc, node) => {
        return acc + (node.text?.length || 0);
      }, 0);

      // ~4000-5000 characters per page for documents with tables/structure
      const estimatedPagesFromChars = Math.max(
        1,
        Math.ceil(totalTextLength / 4000),
      );

      // Take the higher estimate to be conservative
      const estimatedPages = Math.max(
        estimatedPagesFromStructure,
        estimatedPagesFromChars,
      );
      return estimatedPages > 0 ? estimatedPages : null;
    }

    return null;
  } catch (error) {
    console.error("Error getting page count:", error);
    return null;
  }
}
