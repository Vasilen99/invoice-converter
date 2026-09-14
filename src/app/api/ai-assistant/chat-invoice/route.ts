import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";
import type { AddressData } from "@/utility/types";
import { formatAddressForStorage } from "@/utility/company-registry-helpers";
import { getCachedCompanyData } from "@/utility/registry-cache";
import { getTodayForInput } from "@/utility/date-formatter";
import type { BulgarianInvoiceData } from "../../../../types";
import {
  DEFAULT_CURRENCY,
  DEFAULT_INVOICE_NUMBER,
  DEFAULT_UNIT,
  DEFAULT_VAT_PERCENT,
} from "@/utility/constants";
import {
  fetchExternalCompanyByEik,
  normalizeText,
  normalizeEik,
  parseDecimal,
  toMoney,
} from "@/utility/api-helpers/company";
import { generateNextInvoiceNumber } from "@/utility/helpers/api-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Intent = "create_invoice" | "edit_invoice" | "unsupported";
type CompanyRole = "organization" | "contragent";
type CompanyResolutionSource = "DB" | "CACHE" | "EXTERNAL";

type ResolvedCompany = {
  id?: number;
  name: string;
  bulstat: string;
  vatNumber: string | null;
  molName: string | null;
  email: string | null;
  address?: AddressData;
  source: CompanyResolutionSource;
  invoiceSeriesPrefix?: string | null;
  currentInvNumber?: string | null;
};

type PromptExtraction = {
  intent: Intent;
  organizationName: string;
  organizationEik: string;
  contragentName: string;
  contragentEik: string;
  invoicePatch: Partial<BulgarianInvoiceData> & {
    lineItems?: BulgarianInvoiceData["lineItems"];
  };
  chatResponse: string;
};

type ChatResponse = {
  data: {
    intent: Intent;
    assistantMessage: string;
    invoice: BulgarianInvoiceData | null;
    changedFields: string[];
    status:
      | "ok"
      | "unsupported"
      | "missing-draft"
      | "company-not-found"
      | "invalid-input";
  };
};

export type AccountOrgSnapshot = {
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
  current_inv_number: string | number | null;
  contragents: AccountContragentSnapshot[];
};

export type AccountContragentSnapshot = {
  id: number;
  name: string;
  bulstat: string | null;
  vatNumber: string | null;
  molName: string | null;
  address: unknown;
  organizationId: number;
};

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are an invoice assistant intent and field extractor.
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
10) Return JSON only, no markdown or explanations.`;

// ---------------------------------------------------------------------------
// Invoice helpers
// ---------------------------------------------------------------------------

function isExplicitNewDraftPrompt(prompt: string): boolean {
  const normalized = normalizeText(prompt).toLowerCase();
  if (!normalized) return false;
  return [
    "new invoice",
    "new draft",
    "start new",
    "create new",
    "reset invoice",
    "restart invoice",
    "нова фактура",
    "нова чернова",
    "започни нова",
    "създай нова",
  ].some((token) => normalized.includes(token));
}

function formatInvoiceNumber(value: unknown): string {
  const digitsOnly = normalizeText(value).replace(/\D/g, "");
  if (!digitsOnly) return DEFAULT_INVOICE_NUMBER;
  return digitsOnly.padStart(10, "0");
}

function recalculateTotals(lineItems: BulgarianInvoiceData["lineItems"]): {
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
    (sum, item) => sum + item._valueNumber,
    0,
  );
  const vatNumber = normalizedItems.reduce(
    (sum, item) => sum + item._valueNumber * (item._vatPercentNumber / 100),
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

function createBaseInvoice(composerName?: string | null): BulgarianInvoiceData {
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

function sanitizeLineItems(
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

function sanitizeInvoicePatch(
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

/**
 * Edit-safe patch — only keeps fields with non-empty values so the AI
 * cannot accidentally wipe existing invoice data when editing a subset of fields.
 */
function sanitizeEditPatch(
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

function sanitizeInvoice(invoice: BulgarianInvoiceData): BulgarianInvoiceData {
  const patch = sanitizeInvoicePatch(invoice);
  const base = createBaseInvoice(invoice.composer_name);
  const merged = {
    ...base,
    ...patch,
    lineItems: patch.lineItems ?? base.lineItems,
  } as BulgarianInvoiceData;
  const totals = recalculateTotals(merged.lineItems);
  return {
    ...merged,
    lineItems: totals.lineItems,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
    invoiceNumber:
      normalizeText(merged.invoiceNumber) || DEFAULT_INVOICE_NUMBER,
    currency: normalizeText(merged.currency) || DEFAULT_CURRENCY,
  };
}

function mergeInvoice(
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

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

function addressFromUnknown(value: unknown): AddressData | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  return value as AddressData;
}

// ---------------------------------------------------------------------------
// Company resolution — 4-tier pipeline
// ---------------------------------------------------------------------------

function resolveFromAccountContext(input: {
  role: CompanyRole;
  name?: string;
  eik?: string;
  accountOrgs: AccountOrgSnapshot[];
}): ResolvedCompany | null {
  const name = normalizeText(input.name).toLowerCase();
  const eik = normalizeEik(input.eik);
  if (!name && !eik) return null;

  if (input.role === "organization") {
    const match = input.accountOrgs.find((org) =>
      eik && org.bulstat
        ? normalizeEik(org.bulstat) === eik
        : name
          ? org.name.toLowerCase().includes(name)
          : false,
    );
    if (!match) return null;
    return {
      id: match.id,
      name: match.name,
      bulstat: normalizeEik(match.bulstat),
      vatNumber: match.vatNumber,
      molName: match.molName,
      email: null,
      address: addressFromUnknown(match.address),
      source: "DB",
      invoiceSeriesPrefix: match.invoiceSeriesPrefix,
      currentInvNumber: match.current_inv_number
        ? String(match.current_inv_number)
        : null,
    };
  }

  for (const org of input.accountOrgs) {
    const match = org.contragents.find((c) =>
      eik && c.bulstat
        ? normalizeEik(c.bulstat) === eik
        : name
          ? c.name.toLowerCase().includes(name)
          : false,
    );
    if (match) {
      return {
        id: match.id,
        name: match.name,
        bulstat: normalizeEik(match.bulstat),
        vatNumber: match.vatNumber,
        molName: match.molName,
        email: null,
        address: addressFromUnknown(match.address),
        source: "DB",
      };
    }
  }
  return null;
}

async function resolveFromDbByName(input: {
  role: CompanyRole;
  accountId: number;
  name?: string;
}): Promise<ResolvedCompany | null> {
  const query = normalizeText(input.name);
  if (!query) return null;

  if (input.role === "organization") {
    const org = await prisma.organization.findFirst({
      where: {
        accountId: input.accountId,
        name: { contains: query, mode: "insensitive" },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        bulstat: true,
        vatNumber: true,
        molName: true,
        email: true,
        address: true,
        invoiceSeriesPrefix: true,
        current_inv_number: true,
      },
    });
    if (!org?.bulstat) return null;
    return {
      id: org.id,
      name: org.name,
      bulstat: org.bulstat,
      vatNumber: org.vatNumber,
      molName: org.molName,
      email: org.email,
      address: addressFromUnknown(org.address),
      source: "DB",
      invoiceSeriesPrefix: org.invoiceSeriesPrefix,
      currentInvNumber: org.current_inv_number?.toString() ?? null,
    };
  }

  const c = await prisma.contragent.findFirst({
    where: {
      name: { contains: query, mode: "insensitive" },
      organization: { accountId: input.accountId },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      bulstat: true,
      vatNumber: true,
      molName: true,
      email: true,
      address: true,
    },
  });
  if (!c?.bulstat) return null;
  return {
    id: c.id,
    name: c.name,
    bulstat: c.bulstat,
    vatNumber: c.vatNumber,
    molName: c.molName,
    email: c.email,
    address: addressFromUnknown(c.address),
    source: "DB",
  };
}

async function resolveFromDbByEik(input: {
  role: CompanyRole;
  accountId: number;
  eik?: string;
}): Promise<ResolvedCompany | null> {
  const eik = normalizeEik(input.eik);
  if (!eik) return null;

  if (input.role === "organization") {
    const org = await prisma.organization.findFirst({
      where: { accountId: input.accountId, bulstat: eik },
      select: {
        id: true,
        name: true,
        bulstat: true,
        vatNumber: true,
        molName: true,
        email: true,
        address: true,
        invoiceSeriesPrefix: true,
        current_inv_number: true,
      },
    });
    if (!org?.bulstat) return null;
    return {
      id: org.id,
      name: org.name,
      bulstat: org.bulstat,
      vatNumber: org.vatNumber,
      molName: org.molName,
      email: org.email,
      address: addressFromUnknown(org.address),
      source: "DB",
      invoiceSeriesPrefix: org.invoiceSeriesPrefix,
      currentInvNumber: org.current_inv_number?.toString() ?? null,
    };
  }

  const c = await prisma.contragent.findFirst({
    where: { bulstat: eik, organization: { accountId: input.accountId } },
    select: {
      id: true,
      name: true,
      bulstat: true,
      vatNumber: true,
      molName: true,
      email: true,
      address: true,
    },
  });
  if (!c?.bulstat) return null;
  return {
    id: c.id,
    name: c.name,
    bulstat: c.bulstat,
    vatNumber: c.vatNumber,
    molName: c.molName,
    email: c.email,
    address: addressFromUnknown(c.address),
    source: "DB",
  };
}

async function resolveFromCacheByName(
  name?: string,
): Promise<ResolvedCompany | null> {
  const query = normalizeText(name);
  if (!query) return null;

  const hit = await prisma.companyRegistryCache.findFirst({
    where: { name: { contains: query, mode: "insensitive" } },
    orderBy: { lastFetchedAt: "desc" },
    select: { bulstat: true, name: true, vatNumber: true, address: true },
  });
  if (!hit?.bulstat) return null;
  await prisma.companyRegistryCache.update({
    where: { bulstat: hit.bulstat },
    data: { lastFetchedAt: new Date() },
  });
  return {
    name: hit.name,
    bulstat: hit.bulstat,
    vatNumber: hit.vatNumber,
    molName: null,
    email: null,
    address: addressFromUnknown(hit.address),
    source: "CACHE",
  };
}

async function upsertExternalCompanyToDb(input: {
  role: CompanyRole;
  accountId: number;
  primaryOrgId: number | null;
  resolved: ResolvedCompany;
}): Promise<ResolvedCompany> {
  const { resolved, role, accountId, primaryOrgId } = input;
  try {
    if (role === "organization") {
      const existing = await prisma.organization.findFirst({
        where: { accountId, bulstat: resolved.bulstat },
        select: { id: true },
      });
      const addrData = resolved.address
        ? formatAddressForStorage(resolved.address)
        : undefined;
      const upserted = existing
        ? await prisma.organization.update({
            where: { id: existing.id },
            data: {
              name: resolved.name,
              vatNumber: resolved.vatNumber,
              molName: resolved.molName,
              email: resolved.email,
              ...(addrData ? { address: addrData } : {}),
            },
            select: {
              id: true,
              invoiceSeriesPrefix: true,
              current_inv_number: true,
            },
          })
        : await prisma.organization.create({
            data: {
              name: resolved.name,
              bulstat: resolved.bulstat,
              vatNumber: resolved.vatNumber,
              molName: resolved.molName,
              email: resolved.email,
              ...(addrData ? { address: addrData } : {}),
              accountId,
              source: "NAP_API",
            },
            select: {
              id: true,
              invoiceSeriesPrefix: true,
              current_inv_number: true,
            },
          });
      return {
        ...resolved,
        id: upserted.id,
        source: "DB",
        invoiceSeriesPrefix: upserted.invoiceSeriesPrefix,
        currentInvNumber: upserted.current_inv_number?.toString() ?? null,
      };
    }

    if (!primaryOrgId || !resolved.bulstat) return resolved;

    const addrData = resolved.address
      ? formatAddressForStorage(resolved.address)
      : undefined;
    const upserted = await prisma.contragent.upsert({
      where: {
        organizationId_bulstat: {
          organizationId: primaryOrgId,
          bulstat: resolved.bulstat,
        },
      },
      create: {
        name: resolved.name,
        bulstat: resolved.bulstat,
        vatNumber: resolved.vatNumber,
        molName: resolved.molName,
        email: resolved.email,
        ...(addrData ? { address: addrData } : {}),
        organizationId: primaryOrgId,
        source: "NAP_API",
      },
      update: {
        name: resolved.name,
        vatNumber: resolved.vatNumber,
        molName: resolved.molName,
        email: resolved.email,
        ...(addrData ? { address: addrData } : {}),
      },
      select: { id: true },
    });
    return { ...resolved, id: upserted.id, source: "DB" };
  } catch {
    return resolved;
  }
}

async function resolveByEikWithFallback(input: {
  role: CompanyRole;
  accountId: number;
  primaryOrgId: number | null;
  eik?: string;
}): Promise<ResolvedCompany | null> {
  const eik = normalizeEik(input.eik);
  if (!eik) return null;

  const dbHit = await resolveFromDbByEik({
    role: input.role,
    accountId: input.accountId,
    eik,
  });
  if (dbHit) return dbHit;

  const cached = await getCachedCompanyData(eik);
  if (cached) {
    const companyName =
      cached.companyName?.name || cached.companyNameTransliteration?.name || "";
    if (companyName) {
      return {
        name: companyName,
        bulstat: eik,
        vatNumber: cached.registerInfo?.vat ?? null,
        molName: cached.managers?.[0]?.name ?? null,
        email: cached.contacts?.email ?? null,
        address: addressFromUnknown(cached.seat),
        source: "CACHE",
      };
    }
  }

  const external = await fetchExternalCompanyByEik(eik);
  if (!external) return null;

  const resolved: ResolvedCompany = {
    name: external.name,
    bulstat: external.bulstat,
    vatNumber: external.vatNumber,
    molName: external.molName,
    email: external.email,
    address: addressFromUnknown(external.address),
    source: "EXTERNAL",
  };

  return upsertExternalCompanyToDb({
    role: input.role,
    accountId: input.accountId,
    primaryOrgId: input.primaryOrgId,
    resolved,
  });
}

async function resolveCompany(input: {
  role: CompanyRole;
  accountId: number;
  primaryOrgId: number | null;
  accountOrgs: AccountOrgSnapshot[];
  name?: string;
  eik?: string;
}): Promise<ResolvedCompany | null> {
  const name = normalizeText(input.name);
  const eik = normalizeEik(input.eik);

  const fromContext = resolveFromAccountContext({
    role: input.role,
    name,
    eik,
    accountOrgs: input.accountOrgs,
  });
  if (fromContext) return fromContext;

  if (eik) {
    return resolveByEikWithFallback({
      role: input.role,
      accountId: input.accountId,
      primaryOrgId: input.primaryOrgId,
      eik,
    });
  }

  const fromDb = await resolveFromDbByName({
    role: input.role,
    accountId: input.accountId,
    name,
  });
  if (fromDb) return fromDb;

  return resolveFromCacheByName(name);
}

// ---------------------------------------------------------------------------
// JSON / AI extraction
// ---------------------------------------------------------------------------

function parseJSON(jsonString: string): { success: boolean; data?: unknown } {
  try {
    return { success: true, data: JSON.parse(jsonString) };
  } catch {
    return { success: false };
  }
}

function extractJsonFromText(text: string): string | null {
  return text.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

async function extractPromptData(
  prompt: string,
  currentInvoice: BulgarianInvoiceData | null,
): Promise<PromptExtraction> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.responses.create({
    model: "gpt-5.6-luna",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: EXTRACTION_PROMPT },
          { type: "input_text", text: `User prompt: ${prompt}` },
          {
            type: "input_text",
            text: `Current invoice draft JSON: ${currentInvoice ? JSON.stringify(currentInvoice) : "null"}`,
          },
        ],
      },
    ],
  });

  const content = response.output_text ?? "";
  const jsonString = extractJsonFromText(content);

  const fallback: PromptExtraction = {
    intent: "unsupported",
    organizationName: "",
    organizationEik: "",
    contragentName: "",
    contragentEik: "",
    invoicePatch: {},
    chatResponse:
      "I couldn't process that as invoice-related. Please ask me to create or edit an invoice.",
  };

  if (!jsonString) return fallback;

  const parsed = parseJSON(jsonString);
  if (!parsed.success || !parsed.data || typeof parsed.data !== "object")
    return fallback;

  const data = parsed.data as Record<string, unknown>;
  const rawIntent = normalizeText(data.intent);
  const intent: Intent =
    rawIntent === "create_invoice" ||
    rawIntent === "edit_invoice" ||
    rawIntent === "unsupported"
      ? rawIntent
      : "unsupported";

  return {
    intent,
    organizationName: normalizeText(data.organizationName),
    organizationEik: normalizeEik(data.organizationEik),
    contragentName: normalizeText(data.contragentName),
    contragentEik: normalizeEik(data.contragentEik),
    invoicePatch: ((data.invoicePatch as Record<string, unknown>) ??
      {}) as Partial<BulgarianInvoiceData>,
    chatResponse: normalizeText(data.chatResponse),
  };
}

// ---------------------------------------------------------------------------
// Changed-field tracking
// ---------------------------------------------------------------------------

function collectChangedFields(
  previous: BulgarianInvoiceData | null,
  next: BulgarianInvoiceData | null,
): string[] {
  if (!next) return [];
  if (!previous)
    return [
      "invoiceNumber",
      "invoiceDate",
      "taxEventDate",
      "sellerName",
      "sellerEik",
      "buyerName",
      "buyerEik",
      "lineItems",
      "total",
    ];

  const watchedFields: Array<keyof BulgarianInvoiceData> = [
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
    "currency",
    "bank",
    "iban",
    "bic",
  ];

  const changed = watchedFields.filter(
    (field) => normalizeText(previous[field]) !== normalizeText(next[field]),
  );
  if (JSON.stringify(previous.lineItems) !== JSON.stringify(next.lineItems))
    changed.push("lineItems");
  return Array.from(new Set(changed));
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          data: {
            intent: "unsupported" as Intent,
            assistantMessage: "AI is temporarily unavailable.",
            invoice: null,
            changedFields: [],
            status: "invalid-input" as const,
          },
        } satisfies ChatResponse,
        { status: 500 },
      );
    }

    const user = await getUserServer();
    if (!user?.sub) return NextResponse.json({ data: null }, { status: 401 });

    const body = (await request.json()) as {
      prompt?: string;
      currentInvoice?: BulgarianInvoiceData | null;
      accountOrgs?: AccountOrgSnapshot[];
    };

    const prompt = normalizeText(body.prompt);
    if (!prompt) {
      return NextResponse.json(
        {
          data: {
            intent: "unsupported" as Intent,
            assistantMessage: "Prompt is required.",
            invoice: body.currentInvoice
              ? sanitizeInvoice(body.currentInvoice)
              : null,
            changedFields: [],
            status: "invalid-input" as const,
          },
        } satisfies ChatResponse,
        { status: 400 },
      );
    }

    const accountMember = await prisma.accountMember.findFirst({
      where: { user: { auth_uid: user.sub } },
      select: { accountId: true },
    });

    if (!accountMember?.accountId) {
      return NextResponse.json(
        {
          data: {
            intent: "unsupported" as Intent,
            assistantMessage:
              "I couldn't find an account to build your invoice draft.",
            invoice: null,
            changedFields: [],
            status: "invalid-input" as const,
          },
        } satisfies ChatResponse,
        { status: 404 },
      );
    }

    // Use client-supplied account orgs if present, otherwise fetch from DB
    let accountOrgs: AccountOrgSnapshot[] = body.accountOrgs ?? [];

    if (accountOrgs.length === 0) {
      const dbOrgs = await prisma.organization.findMany({
        where: { accountId: accountMember.accountId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          bulstat: true,
          vatNumber: true,
          molName: true,
          address: true,
          bank: true,
          iban: true,
          bic: true,
          invoiceSeriesPrefix: true,
          current_inv_number: true,
          contragents: {
            select: {
              id: true,
              name: true,
              bulstat: true,
              vatNumber: true,
              molName: true,
              address: true,
              organizationId: true,
            },
          },
        },
      });
      accountOrgs = dbOrgs.map((o) => ({
        ...o,
        current_inv_number: o.current_inv_number
          ? o.current_inv_number.toString()
          : null,
      }));
    }

    const composerName = await prisma.account
      .findUnique({
        where: { id: accountMember.accountId },
        select: { composer_name: true },
      })
      .then((a) => a?.composer_name ?? null);

    const extraction = await extractPromptData(
      prompt,
      body.currentInvoice ? sanitizeInvoice(body.currentInvoice) : null,
    );

    if (extraction.intent === "unsupported") {
      return NextResponse.json(
        {
          data: {
            intent: extraction.intent,
            assistantMessage:
              extraction.chatResponse ||
              "I currently support only invoice generation and invoice edits.",
            invoice: body.currentInvoice
              ? sanitizeInvoice(body.currentInvoice)
              : null,
            changedFields: [],
            status: "unsupported" as const,
          },
        } satisfies ChatResponse,
        { status: 200 },
      );
    }

    const currentInvoice = body.currentInvoice
      ? sanitizeInvoice(body.currentInvoice)
      : null;

    if (extraction.intent === "edit_invoice" && !currentInvoice) {
      return NextResponse.json(
        {
          data: {
            intent: extraction.intent,
            assistantMessage:
              extraction.chatResponse ||
              "Start by asking me to generate an invoice draft first.",
            invoice: null,
            changedFields: [],
            status: "missing-draft" as const,
          },
        } satisfies ChatResponse,
        { status: 200 },
      );
    }

    const primaryOrg = accountOrgs[0] ?? null;
    const primaryOrgId = primaryOrg?.id ?? null;

    const organizationInputName =
      normalizeText(extraction.invoicePatch.sellerName) ||
      extraction.organizationName;
    const organizationInputEik =
      normalizeEik(extraction.invoicePatch.sellerEik) ||
      extraction.organizationEik;
    const contragentInputName =
      normalizeText(extraction.invoicePatch.buyerName) ||
      extraction.contragentName;
    const contragentInputEik =
      normalizeEik(extraction.invoicePatch.buyerEik) ||
      extraction.contragentEik;

    let organizationResolved =
      organizationInputName || organizationInputEik
        ? await resolveCompany({
            role: "organization",
            accountId: accountMember.accountId,
            primaryOrgId,
            accountOrgs,
            name: organizationInputName,
            eik: organizationInputEik,
          })
        : null;

    let contragentResolved =
      contragentInputName || contragentInputEik
        ? await resolveCompany({
            role: "contragent",
            accountId: accountMember.accountId,
            primaryOrgId,
            accountOrgs,
            name: contragentInputName,
            eik: contragentInputEik,
          })
        : null;

    const organizationLookupAsked =
      Boolean(organizationInputName) || Boolean(organizationInputEik);
    const contragentLookupAsked =
      Boolean(contragentInputName) || Boolean(contragentInputEik);

    // Cross-role fallback for single-company prompts
    if (
      organizationLookupAsked &&
      !organizationResolved &&
      !contragentLookupAsked
    ) {
      const crossHit = await resolveCompany({
        role: "contragent",
        accountId: accountMember.accountId,
        primaryOrgId,
        accountOrgs,
        name: organizationInputName,
        eik: organizationInputEik,
      });
      if (crossHit) contragentResolved = crossHit;
    }
    if (
      contragentLookupAsked &&
      !contragentResolved &&
      !organizationLookupAsked
    ) {
      const crossHit = await resolveCompany({
        role: "organization",
        accountId: accountMember.accountId,
        primaryOrgId,
        accountOrgs,
        name: contragentInputName,
        eik: contragentInputEik,
      });
      if (crossHit) organizationResolved = crossHit;
    }

    const companyNotFound =
      (organizationLookupAsked && !organizationResolved) ||
      (contragentLookupAsked && !contragentResolved);

    if (companyNotFound) {
      return NextResponse.json(
        {
          data: {
            intent: extraction.intent,
            assistantMessage:
              extraction.chatResponse ||
              "I couldn't find company information from your prompt. Please verify the company name/EIK and try again.",
            invoice: currentInvoice,
            changedFields: [],
            status: "company-not-found" as const,
          },
        } satisfies ChatResponse,
        { status: 200 },
      );
    }

    const shouldStartFreshDraft =
      !currentInvoice ||
      (extraction.intent === "create_invoice" &&
        isExplicitNewDraftPrompt(prompt));

    let nextInvoice = shouldStartFreshDraft
      ? createBaseInvoice(composerName)
      : (currentInvoice as BulgarianInvoiceData);

    if (primaryOrg && shouldStartFreshDraft) {
      nextInvoice.sellerName = primaryOrg.name;
      nextInvoice.sellerEik = normalizeEik(primaryOrg.bulstat);
      nextInvoice.sellerVatNumber = normalizeText(primaryOrg.vatNumber);
      nextInvoice.sellerMol = normalizeText(primaryOrg.molName);
      const orgAddr = addressFromUnknown(primaryOrg.address);
      nextInvoice.sellerCity =
        normalizeText(orgAddr?.settlement) || nextInvoice.sellerCity;
      nextInvoice.sellerAddress = normalizeText(orgAddr?.street);
      nextInvoice.bank = normalizeText(primaryOrg.bank);
      nextInvoice.iban = normalizeText(primaryOrg.iban);
      nextInvoice.bic = normalizeText(primaryOrg.bic);
      nextInvoice.invoiceNumber = generateNextInvoiceNumber(
        primaryOrg.invoiceSeriesPrefix,
        primaryOrg.current_inv_number,
      );
    }

    // Apply AI patch — edit-safe for edits (only non-empty changed fields), full for creates
    const patch =
      extraction.intent === "edit_invoice"
        ? sanitizeEditPatch(extraction.invoicePatch)
        : sanitizeInvoicePatch(extraction.invoicePatch);

    nextInvoice = mergeInvoice(nextInvoice, patch);

    if (organizationResolved) {
      nextInvoice.sellerName = organizationResolved.name;
      nextInvoice.sellerEik = organizationResolved.bulstat;
      nextInvoice.sellerVatNumber = normalizeText(
        organizationResolved.vatNumber,
      );
      nextInvoice.sellerMol = normalizeText(organizationResolved.molName);
      nextInvoice.sellerCity =
        normalizeText(organizationResolved.address?.settlement) ||
        nextInvoice.sellerCity;
      nextInvoice.sellerAddress =
        normalizeText(organizationResolved.address?.street) ||
        nextInvoice.sellerAddress;

      if (
        shouldStartFreshDraft &&
        !(patch.invoiceNumber && normalizeText(patch.invoiceNumber))
      ) {
        nextInvoice.invoiceNumber =
          organizationResolved.source === "DB"
            ? generateNextInvoiceNumber(
                organizationResolved.invoiceSeriesPrefix,
                organizationResolved.currentInvNumber,
              )
            : formatInvoiceNumber(nextInvoice.invoiceNumber);
      }
    }

    if (contragentResolved) {
      nextInvoice.buyerName = contragentResolved.name;
      nextInvoice.buyerEik = contragentResolved.bulstat;
      nextInvoice.buyerVatNumber = normalizeText(contragentResolved.vatNumber);
      nextInvoice.buyerMol = normalizeText(contragentResolved.molName);
      nextInvoice.buyerCity =
        normalizeText(contragentResolved.address?.settlement) ||
        nextInvoice.buyerCity;
      nextInvoice.buyerAddress =
        normalizeText(contragentResolved.address?.street) ||
        nextInvoice.buyerAddress;
    }

    nextInvoice = sanitizeInvoice(nextInvoice);

    const changedFields = collectChangedFields(currentInvoice, nextInvoice);

    return NextResponse.json(
      {
        data: {
          intent: extraction.intent,
          assistantMessage:
            extraction.chatResponse ||
            (changedFields.length
              ? `Done. Updated: ${changedFields.join(", ")}.`
              : "I parsed your request. Please add more invoice details if needed."),
          invoice: nextInvoice,
          changedFields,
          status: "ok" as const,
        },
      } satisfies ChatResponse,
      { status: 200 },
    );
  } catch (error) {
    console.error("[ai-assistant/chat-invoice] Error:", error);
    return NextResponse.json(
      {
        data: {
          intent: "unsupported" as Intent,
          assistantMessage: "Failed to process the request.",
          invoice: null,
          changedFields: [],
          status: "invalid-input" as const,
        },
      } satisfies ChatResponse,
      { status: 500 },
    );
  }
}
