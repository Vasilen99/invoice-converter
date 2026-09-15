import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";
import type { AddressData } from "@/utility/types";
import { formatAddressForStorage } from "@/utility/company-registry-helpers";
import { getCachedCompanyData } from "@/utility/registry-cache";
import type { BulgarianInvoiceData } from "../../../../types";
import { DEFAULT_INVOICE_NUMBER } from "@/utility/constants";
import {
  fetchExternalCompanyByEik,
  normalizeText,
  normalizeEik,
  createBaseInvoice,
  formatInvoiceNumber,
  generateNextInvoiceNumber,
  mergeInvoice,
  parseJsonAddress,
  sanitizeEditPatch,
  sanitizeInvoice,
  sanitizeInvoicePatch,
} from "@/utility/api-helpers";
import { EXTRACT_FROM_PROMPT } from "@/utility/constants";
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
  bank?: string | null;
  iban?: string | null;
  bic?: string | null;
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

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

function addressFromUnknown(value: unknown): AddressData | undefined {
  const parsed = parseJsonAddress(value);
  return parsed ?? undefined;
}

// ---------------------------------------------------------------------------
// Company resolution — 4-tier pipeline
// ---------------------------------------------------------------------------

function resolveFromAccountContext(input: {
  role: CompanyRole;
  name?: string;
  eik?: string;
  accountOrgs: AccountOrgSnapshot[];
  scopedOrganizationId?: number | null;
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
      bank: match.bank,
      iban: match.iban,
      bic: match.bic,
    };
  }

  const scopedOrgs = input.scopedOrganizationId
    ? input.accountOrgs.filter((org) => org.id === input.scopedOrganizationId)
    : input.accountOrgs;

  for (const org of scopedOrgs) {
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
  scopedOrganizationId?: number | null;
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
        bank: true,
        iban: true,
        bic: true,
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
      bank: org.bank,
      iban: org.iban,
      bic: org.bic,
    };
  }

  const c = await prisma.contragent.findFirst({
    where: {
      name: { contains: query, mode: "insensitive" },
      organization: {
        accountId: input.accountId,
        ...(input.scopedOrganizationId
          ? { id: input.scopedOrganizationId }
          : {}),
      },
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
  scopedOrganizationId?: number | null;
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
        bank: true,
        iban: true,
        bic: true,
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
      bank: org.bank,
      iban: org.iban,
      bic: org.bic,
    };
  }

  const c = await prisma.contragent.findFirst({
    where: {
      bulstat: eik,
      organization: {
        accountId: input.accountId,
        ...(input.scopedOrganizationId
          ? { id: input.scopedOrganizationId }
          : {}),
      },
    },
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
  scopedOrganizationId?: number | null;
}): Promise<ResolvedCompany | null> {
  const eik = normalizeEik(input.eik);
  if (!eik) return null;

  const dbHit = await resolveFromDbByEik({
    role: input.role,
    accountId: input.accountId,
    eik,
    scopedOrganizationId: input.scopedOrganizationId,
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
    primaryOrgId: input.scopedOrganizationId ?? input.primaryOrgId,
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
  scopedOrganizationId?: number | null;
}): Promise<ResolvedCompany | null> {
  const name = normalizeText(input.name);
  const eik = normalizeEik(input.eik);

  const fromContext = resolveFromAccountContext({
    role: input.role,
    name,
    eik,
    accountOrgs: input.accountOrgs,
    scopedOrganizationId: input.scopedOrganizationId,
  });
  if (fromContext) return fromContext;

  if (eik) {
    return resolveByEikWithFallback({
      role: input.role,
      accountId: input.accountId,
      primaryOrgId: input.primaryOrgId,
      eik,
      scopedOrganizationId: input.scopedOrganizationId,
    });
  }

  const fromDb = await resolveFromDbByName({
    role: input.role,
    accountId: input.accountId,
    name,
    scopedOrganizationId: input.scopedOrganizationId,
  });
  if (fromDb) return fromDb;

  return null;
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
          { type: "input_text", text: EXTRACT_FROM_PROMPT },
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
            primaryOrgId: organizationResolved?.id ?? primaryOrgId,
            accountOrgs,
            name: contragentInputName,
            eik: contragentInputEik,
            scopedOrganizationId: organizationResolved?.id ?? null,
          })
        : null;

    const organizationLookupAsked =
      Boolean(organizationInputName) || Boolean(organizationInputEik);
    const contragentLookupAsked =
      Boolean(contragentInputName) || Boolean(contragentInputEik);

    const missingOrganization =
      organizationLookupAsked && !organizationResolved;
    const missingContragent = contragentLookupAsked && !contragentResolved;

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

    const hasExplicitInvoiceNumber = Boolean(
      patch.invoiceNumber && normalizeText(patch.invoiceNumber),
    );
    const previousSellerEik = normalizeEik(currentInvoice?.sellerEik);

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

      if (!normalizeText(patch.bank)) {
        nextInvoice.bank =
          normalizeText(organizationResolved.bank) || nextInvoice.bank;
      }
      if (!normalizeText(patch.iban)) {
        nextInvoice.iban =
          normalizeText(organizationResolved.iban) || nextInvoice.iban;
      }
      if (!normalizeText(patch.bic)) {
        nextInvoice.bic =
          normalizeText(organizationResolved.bic) || nextInvoice.bic;
      }

      const sellerWasUpdated =
        Boolean(organizationResolved.bulstat) &&
        organizationResolved.bulstat !== previousSellerEik;
      const invoiceIsDefault =
        normalizeText(nextInvoice.invoiceNumber) === DEFAULT_INVOICE_NUMBER;

      if (
        !hasExplicitInvoiceNumber &&
        (shouldStartFreshDraft || sellerWasUpdated || invoiceIsDefault)
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
    } else if (missingContragent && shouldStartFreshDraft) {
      nextInvoice.buyerName = "";
      nextInvoice.buyerEik = "";
      nextInvoice.buyerVatNumber = "";
      nextInvoice.buyerMol = "";
      nextInvoice.buyerCity = "";
      nextInvoice.buyerAddress = "";
    }

    nextInvoice = sanitizeInvoice(nextInvoice);

    const missingCompanyNames: string[] = [];
    if (missingOrganization) {
      missingCompanyNames.push(
        organizationInputName || organizationInputEik || "продавач",
      );
    }
    if (missingContragent) {
      missingCompanyNames.push(
        contragentInputName || contragentInputEik || "получател",
      );
    }

    const hasMissingCompanies = missingCompanyNames.length > 0;
    const missingMessage = hasMissingCompanies
      ? `Компания ${missingCompanyNames.map((n) => `"${n}"`).join(" и ")} не беше намерена. Моля проверете името/ЕИК и опитайте отново или я добавете ръчно в профила.`
      : "";

    const buyerSkippedNote =
      missingContragent && !missingOrganization
        ? " Черновата е визуализирана без данни за получателя."
        : "";

    const assistantMessage = hasMissingCompanies
      ? `${missingMessage}${buyerSkippedNote}`.trim()
      : extraction.chatResponse ||
        "I parsed your request. Please add more invoice details if needed.";

    return NextResponse.json(
      {
        data: {
          intent: extraction.intent,
          assistantMessage,
          invoice: nextInvoice,
          status: hasMissingCompanies
            ? ("company-not-found" as const)
            : ("ok" as const),
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
          status: "invalid-input" as const,
        },
      } satisfies ChatResponse,
      { status: 500 },
    );
  }
}
