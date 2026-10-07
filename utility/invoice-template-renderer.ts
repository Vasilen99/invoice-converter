import { formatDateToBG } from "@/utility/date-formatter";
import {
  getDefaultInvoiceTemplateHtml,
  normalizeTemplateHtml,
} from "@/utility/invoice-template";
import type { BulgarianInvoiceData } from "@/types";

const LINE_ITEM_REPEAT_TBODY_REGEX =
  /<tbody([^>]*\sdata-repeat=(['"])lineItem\2[^>]*)>([\s\S]*?)<\/tbody>/gi;
const LINE_ITEM_REPEAT_ATTR_REGEX = /data-repeat=(['"])lineItem\1/i;
const LEGACY_LINE_ITEM_ROW_REGEX =
  /<tr\b[^>]*>[\s\S]*?{{\s*(?:lineItemDescription|lineItem\.description|lineItemValue|lineItem\.value)\s*}}[\s\S]*?<\/tr>/i;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: string | undefined): string {
  return formatDateToBG(value) || value || "";
}

function asValue(value: string | undefined | null): string {
  return value ?? "";
}

function buildTokenMap(
  invoice: BulgarianInvoiceData,
  lineItem?: BulgarianInvoiceData["lineItems"][number],
  lineIndex = 0,
): Record<string, string> {
  const firstLine = invoice.lineItems[0] ??
    lineItem ?? {
      description: "",
      unit: "",
      quantity: "",
      unitPrice: "",
      vatPercent: "",
      value: "",
    };

  const row = lineItem ?? firstLine;

  return {
    invoiceNumber: asValue(invoice.invoiceNumber),
    invoiceDate: formatDate(invoice.invoiceDate),
    taxEventDate: formatDate(invoice.taxEventDate),
    location: asValue(invoice.location),

    sellerName: asValue(invoice.sellerName),
    sellerEik: asValue(invoice.sellerEik),
    sellerVatNumber: asValue(invoice.sellerVatNumber),
    sellerCity: asValue(invoice.sellerCity),
    sellerAddress: asValue(invoice.sellerAddress),
    sellerMol: asValue(invoice.sellerMol),

    buyerName: asValue(invoice.buyerName),
    buyerEik: asValue(invoice.buyerEik),
    buyerVatNumber: asValue(invoice.buyerVatNumber),
    buyerCity: asValue(invoice.buyerCity),
    buyerAddress: asValue(invoice.buyerAddress),
    buyerMol: asValue(invoice.buyerMol),

    subtotal: asValue(invoice.subtotal),
    vatAmount: asValue(invoice.vatAmount),
    total: asValue(invoice.total),
    totalInWords: asValue(invoice.totalInWords),
    currency: asValue(invoice.currency),

    composer_name: asValue(invoice.composer_name),
    composerName: asValue(invoice.composer_name),
    bank: asValue(invoice.bank),
    iban: asValue(invoice.iban),
    bic: asValue(invoice.bic),

    "lineItem.number": String(lineIndex + 1),
    "lineItem.index": String(lineIndex + 1),
    "lineItem.description": asValue(row.description),
    "lineItem.unit": asValue(row.unit),
    "lineItem.quantity": asValue(row.quantity),
    "lineItem.unitPrice": asValue(row.unitPrice),
    "lineItem.vatPercent": asValue(row.vatPercent),
    "lineItem.value": asValue(row.value),

    lineItemDescription: asValue(firstLine.description),
    lineItemUnit: asValue(firstLine.unit),
    lineItemQuantity: asValue(firstLine.quantity),
    lineItemUnitPrice: asValue(firstLine.unitPrice),
    lineItemVatPercent: asValue(firstLine.vatPercent),
    lineItemValue: asValue(firstLine.value),
  };
}

function replacePlaceholders(
  input: string,
  values: Record<string, string>,
): string {
  return input.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) =>
    escapeHtml(values[key] ?? ""),
  );
}

function expandLegacyLineItemRows(templateHtml: string): string {
  // Only expand if the template does NOT already have data-repeat attribute
  if (LINE_ITEM_REPEAT_ATTR_REGEX.test(templateHtml)) {
    return templateHtml;
  }

  const legacyRow = templateHtml.match(LEGACY_LINE_ITEM_ROW_REGEX)?.[0];
  if (!legacyRow) {
    return templateHtml;
  }

  // For legacy templates: find the <tbody> containing the legacy row
  // and mark it with data-repeat="lineItem" so the main replacement handles it uniformly
  const tbodyWithLegacyRow = templateHtml.match(
    /<tbody[^>]*>([\s\S]*?)<\/tbody>/i,
  );
  if (!tbodyWithLegacyRow) {
    return templateHtml;
  }

  const tbodyOpenTag = templateHtml.substring(
    templateHtml.indexOf("<tbody"),
    templateHtml.indexOf(">", templateHtml.indexOf("<tbody")) + 1,
  );

  const updatedTbodyOpen = tbodyOpenTag.includes('data-repeat="lineItem"')
    ? tbodyOpenTag
    : tbodyOpenTag.replace(">", ' data-repeat="lineItem">');

  return templateHtml.replace(tbodyOpenTag, updatedTbodyOpen);
}

export function resolveInvoiceTemplateHtml(
  savedTemplate: string | null | undefined,
): string {
  const fallback = getDefaultInvoiceTemplateHtml();
  const normalized = normalizeTemplateHtml(savedTemplate ?? "");
  return normalized || fallback;
}

export function renderInvoiceTemplateHtml(
  templateHtml: string,
  invoiceData: BulgarianInvoiceData,
): string {
  if (!templateHtml) {
    return "";
  }

  const lineItems =
    invoiceData.lineItems.length > 0
      ? invoiceData.lineItems
      : [
          {
            description: "",
            unit: "",
            quantity: "",
            unitPrice: "",
            vatPercent: "",
            value: "",
          },
        ];

  const templateWithExpandedLegacyRows = expandLegacyLineItemRows(templateHtml);

  const withRepeatedRows = templateWithExpandedLegacyRows.replace(
    LINE_ITEM_REPEAT_TBODY_REGEX,
    (match: string, attrs: string, quote: string, inner: string) => {
      const attrsWithoutRepeat = attrs.replace(
        new RegExp(`\\sdata-repeat=${quote}lineItem${quote}`, "i"),
        "",
      );

      const rows = lineItems
        .map((lineItem, index) =>
          replacePlaceholders(
            inner,
            buildTokenMap(invoiceData, lineItem, index),
          ),
        )
        .join("");

      return `<tbody${attrsWithoutRepeat}>${rows}</tbody>`;
    },
  );

  return replacePlaceholders(withRepeatedRows, buildTokenMap(invoiceData));
}
