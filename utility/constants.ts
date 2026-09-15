import { AlertStatus } from "./types";

export const EMAIL_REGEX =
  /^(([^<>()[\]\.,;:\s@"]+(\.[^<>()[\]\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$/i; // eslint-disable-line no-useless-escape

const dev = process.env.NODE_ENV !== "production";

// Use NEXT_PUBLIC_APP_URL for flexibility, falls back to localhost:8000
// This allows easy override via environment variables for different environments
const devServer = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8000";

export const server = dev
  ? devServer
  : "https://invoice-converter-fawn.vercel.app";

export const INITIAL_STATUS: AlertStatus = {
  status: "",
  statusHeader: "",
  statusContent: "",
};

export const PLATFORM_NAME = "Invoice Converter";
export const PROTECTED_ROUTES = ["/generator"];

export const DEFAULT_UNIT = "бр.";
export const DEFAULT_VAT_PERCENT = "20";
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_INVOICE_NUMBER = "0000000001";

export const EXTRACT_PROMPT = `You are an invoice data extraction specialist. Extract all available data from this Stripe invoice PDF and return it as a valid JSON object with the following structure (use empty string "" for missing fields):
{
  "invoiceNumber": string,
  "invoiceDate": string,
  "taxEventDate": string,
  "location": string,
  "sellerName": string,
  "sellerEik": string,
  "sellerVatNumber": string,
  "sellerCity": string,
  "sellerAddress": string,
  "sellerMol": string,
  "buyerName": string,
  "buyerEik": string,
  "buyerVatNumber": string,
  "buyerCity": string,
  "buyerAddress": string,
  "buyerMol": string,
  "lineItems": [{ "description": string, "unit": string, "quantity": string, "unitPrice": string, "vatPercent": string, "value": string }],
  "subtotal": string,
  "vatAmount": string,
  "total": string,
  "totalInWords": string,
  "currency": string
}

Notes:
- invoiceDate and taxEventDate should be in DD-MM-YYYY format
- for taxEventDate, look for "Дата на данъчно събитие" / "Tax Event Date" / "Падеж" / "Due Date" / "Дата на падеж"
- SELLER (sellerName, sellerEik, etc.) is the company/entity that ISSUED the invoice (the "From" or "Billed by" section)
- BUYER (buyerName, buyerEik, etc.) is the company/entity that RECEIVES the invoice (the "Bill to" or "Customer" section)
- For sellerEik and buyerEik try to find company registration numbers / EIK / tax IDs
- For sellerVatNumber and buyerVatNumber look for VAT / ДДС numbers (prefix with BG if Bulgarian)
- For sellerMol and buyerMol look for the person responsible / МОЛ / contact person
- For lineItems.unit use "бр." if not specified
- For lineItems.vatPercent use "20.00" if not specified
- For totalInWords write the total amount in Bulgarian words (e.g. "Деветстотин и шестдесет евро")
- Return ONLY the JSON object, no extra text.`;

export const EXTRACT_FROM_PROMPT = `You are an invoice assistant intent and field extractor.
You will receive a user prompt and optionally a current invoice draft.

Return ONLY valid JSON with this exact structure:
{
  "intent": "create_invoice" | "edit_invoice" | "unsupported",
  "organizationName": string,
  "organizationEik": string,
  "contragentName": string,
  "contragentEik": string,
  "invoicePatch": {
    "invoiceNumber": string,
    "invoiceDate": string,
    "taxEventDate": string,
    "location": string,
    "sellerName": string,
    "sellerEik": string,
    "sellerVatNumber": string,
    "sellerCity": string,
    "sellerAddress": string,
    "sellerMol": string,
    "buyerName": string,
    "buyerEik": string,
    "buyerVatNumber": string,
    "buyerCity": string,
    "buyerAddress": string,
    "buyerMol": string,
    "lineItems": [{ "description": string, "unit": string, "quantity": string, "unitPrice": string, "vatPercent": string, "value": string }],
    "subtotal": string,
    "vatAmount": string,
    "total": string,
    "totalInWords": string,
    "currency": string,
    "bank": string,
    "iban": string,
    "bic": string
  },
  "chatResponse": string
}

Rules:
1) intent=create_invoice when user asks to create/generate/build an invoice draft.
2) intent=edit_invoice when user asks to change/add/edit an existing invoice field.
3) intent=unsupported for unrelated prompts (weather, code, jokes, etc.).
4) If user mentions only one company in a create prompt without explicit role, treat it as organization/seller by default.
5) Extract EIK as digits only (9-13), names as plain text.
6) CRITICAL for edit_invoice: put ONLY the fields the user explicitly asked to change into invoicePatch. Completely omit all other fields — do NOT include them as empty strings or zeroes.
7) For create_invoice: include all fields you can extract from the prompt.
8) For line item requests, include full line item entries.
9) chatResponse must be short and in the same language as the user prompt.
10) Return JSON only, no markdown or explanations.
11) If currency is specified as direct name (e.g., "euro", "долар"), convert it to the appropriate currency code (e.g., "EUR", "USD").
12) totalInWords must be in Bulgarian and shall represent the "total" including VAT, even if the prompt is in another language.`;
