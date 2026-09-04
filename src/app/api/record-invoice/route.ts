import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";
import { BulgarianInvoiceData } from "../../../types";
import { notFound } from "next/navigation";
import {
  extractEmail,
  extractManagerName,
  extractVatNumber,
  formatAddressForStorage,
  transformAddressFromCompanyData,
} from "../../../../utility/company-registry-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeBulstat(value: string | undefined | null): string {
  return (value ?? "").trim();
}

type RegistryCompanyData = {
  bulstat: string;
  name: string;
  vatNumber: string | null;
  address: ReturnType<typeof transformAddressFromCompanyData>;
  molName: string;
  email: string | null;
  rawLookupData: unknown;
};

async function fetchCompanyFromExternalApi(
  bulstat: string,
): Promise<RegistryCompanyData | null> {
  const apiKey = process.env.COMPANY_BOOK_API_KEY;

  if (!apiKey || !bulstat) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.companybook.bg/api/companies/${bulstat}?with_data=true`,
      {
        headers: {
          "X-API-Key": apiKey,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const company = data.company || data;
    const companyName =
      company?.companyName?.name ||
      company?.companyNameTransliteration?.name ||
      "";

    if (!companyName) {
      return null;
    }

    return {
      bulstat: normalizeBulstat(company?.uic || bulstat),
      name: companyName,
      vatNumber: extractVatNumber(company),
      address: transformAddressFromCompanyData(company),
      molName: extractManagerName(company),
      email: extractEmail(company),
      rawLookupData: company,
    };
  } catch {
    return null;
  }
}

async function upsertCompanyRegistryCache(input: {
  bulstat: string;
  name: string;
  vatNumber: string | null;
  address: Record<string, unknown> | undefined;
  rawLookupData?: unknown;
}): Promise<number | null> {
  if (!input.bulstat || !input.name) {
    return null;
  }

  const existing = await prisma.companyRegistryCache.findUnique({
    where: { bulstat: input.bulstat },
    select: { id: true },
  });

  if (existing) {
    await prisma.companyRegistryCache.update({
      where: { bulstat: input.bulstat },
      data: {
        name: input.name,
        vatNumber: input.vatNumber,
        address: (input.address as any) ?? undefined,
        rawLookupData:
          input.rawLookupData === undefined
            ? undefined
            : (input.rawLookupData as any),
        lastFetchedAt: new Date(),
      },
    });
    return existing.id;
  }

  const created = await prisma.companyRegistryCache.create({
    data: {
      bulstat: input.bulstat,
      name: input.name,
      vatNumber: input.vatNumber,
      address: (input.address as any) ?? undefined,
      rawLookupData:
        input.rawLookupData === undefined ? null : (input.rawLookupData as any),
      lastFetchedAt: new Date(),
      createdAt: new Date(),
    },
    select: { id: true },
  });

  return created.id;
}

/**
 * Parse a DD.MM.YYYY date string into a JS Date.
 * Falls back to today if the string is invalid.
 */
function parseBGDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split(".");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Parse a numeric string that may contain currency symbols / spaces.
 */
function parseDecimal(value: string | undefined): number {
  const cleaned = (value ?? "0").replace(/[^\d.,-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseInvoiceNumber(
  invoiceNumber: string,
  defaultSeries: string,
): { series: string; seq: number } {
  const trimmed = (invoiceNumber ?? "").trim();

  // Match optional alpha prefix, optional separator, digits
  const match = trimmed.match(/^([A-Za-zА-Яа-яЁё]+)[-\s]?(\d+)$/u);
  if (match) {
    return { series: match[1].toUpperCase(), seq: parseInt(match[2], 10) };
  }

  // Pure digits
  const numOnly = parseInt(trimmed.replace(/\D/g, ""), 10);
  return {
    series: defaultSeries || "INV",
    seq: isNaN(numOnly) || numOnly <= 0 ? 1 : numOnly,
  };
}

// ---------------------------------------------------------------------------
// POST /api/record-invoice
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserServer();
    if (!user?.sub) {
      notFound();
    }

    const body = (await request.json()) as {
      invoiceData: BulgarianInvoiceData;
      originalFilename?: string;
      sourceDocumentUrl?: string | null;
    };

    const {
      invoiceData,
      originalFilename = "invoice.pdf",
      sourceDocumentUrl = null,
    } = body;

    if (!invoiceData) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "uploader.alerts.invalidInvoicePayloadHeader",
            message: "uploader.alerts.invalidInvoicePayloadMessage",
          },
        },
        { status: 400 },
      );
    }

    const sellerEik = normalizeBulstat(invoiceData.sellerEik);
    const buyerEik = normalizeBulstat(invoiceData.buyerEik);

    if (!sellerEik || !buyerEik) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "uploader.alerts.requiredEikHeader",
            message: "uploader.alerts.requiredEikMessage",
          },
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------------
    // Resolve current user's DB record and account
    // ------------------------------------------------------------------
    const dbUser = await prisma.user.findUnique({
      where: { auth_uid: user.sub },
      select: { id: true },
    });

    if (!dbUser) {
      return notFound();
    }

    const accountMember = await prisma.accountMember.findFirst({
      where: { userId: dbUser.id },
      select: { accountId: true },
    });

    if (!accountMember) {
      return notFound();
    }

    // ------------------------------------------------------------------
    // Resolve organization (seller) by bulstat within this account
    // ------------------------------------------------------------------
    let organization = sellerEik
      ? await prisma.organization.findFirst({
          where: {
            accountId: accountMember.accountId,
            bulstat: sellerEik,
          },
          select: {
            id: true,
            invoiceSeriesPrefix: true,
          },
        })
      : null;

    // ------------------------------------------------------------------
    // Resolve contragent (buyer) by bulstat within that organization
    // ------------------------------------------------------------------
    let contragent = null;

    // Parse invoice number early to extract numeric sequence
    // We'll use this for organization current_inv_number updates/creation.
    const defaultSeriesPrefix = "INV";
    const { seq: invoiceSeq } = parseInvoiceNumber(
      invoiceData.invoiceNumber,
      defaultSeriesPrefix,
    );

    // Auto-create organization if it doesn't exist
    if (!organization && sellerEik) {
      const sellerFromExternal = await fetchCompanyFromExternalApi(sellerEik);
      const sellerAddress = formatAddressForStorage(
        sellerFromExternal?.address ?? {
          street: invoiceData.sellerAddress || "",
          settlement: invoiceData.sellerCity || "",
        },
      );

      const registryId = await upsertCompanyRegistryCache({
        bulstat: sellerEik,
        name: sellerFromExternal?.name || invoiceData.sellerName || sellerEik,
        vatNumber:
          sellerFromExternal?.vatNumber || invoiceData.sellerVatNumber || null,
        address: sellerAddress,
        rawLookupData: sellerFromExternal?.rawLookupData,
      });

      organization = await prisma.organization.create({
        data: {
          accountId: accountMember.accountId,
          bulstat: sellerEik,
          name: sellerFromExternal?.name || invoiceData.sellerName || "",
          vatNumber:
            sellerFromExternal?.vatNumber ||
            invoiceData.sellerVatNumber ||
            null,
          molName: sellerFromExternal?.molName || invoiceData.sellerMol || null,
          email: sellerFromExternal?.email || null,
          address: sellerAddress,
          invoiceSeriesPrefix: "INV",
          current_inv_number: invoiceSeq,
          source: sellerFromExternal ? "NAP_API" : "MANUAL",
          registryId,
        },
        select: {
          id: true,
          invoiceSeriesPrefix: true,
        },
      });

      if (buyerEik) {
        const buyerFromExternal = await fetchCompanyFromExternalApi(buyerEik);
        const buyerAddress = formatAddressForStorage(
          buyerFromExternal?.address ?? {
            street: invoiceData.buyerAddress || "",
            settlement: invoiceData.buyerCity || "",
          },
        );

        const buyerRegistryId = await upsertCompanyRegistryCache({
          bulstat: buyerEik,
          name: buyerFromExternal?.name || invoiceData.buyerName || buyerEik,
          vatNumber:
            buyerFromExternal?.vatNumber || invoiceData.buyerVatNumber || null,
          address: buyerAddress,
          rawLookupData: buyerFromExternal?.rawLookupData,
        });

        contragent = await prisma.contragent.create({
          data: {
            organizationId: organization.id,
            bulstat: buyerEik,
            name: buyerFromExternal?.name || invoiceData.buyerName || "",
            vatNumber:
              buyerFromExternal?.vatNumber ||
              invoiceData.buyerVatNumber ||
              null,
            molName: buyerFromExternal?.molName || invoiceData.buyerMol || null,
            email: buyerFromExternal?.email || null,
            address: buyerAddress,
            source: buyerFromExternal ? "NAP_API" : "MANUAL",
            registryId: buyerRegistryId,
            rawLookupData:
              buyerFromExternal?.rawLookupData === undefined
                ? null
                : (buyerFromExternal.rawLookupData as any),
          },
          select: { id: true },
        });
      }
    }

    if (organization && buyerEik && !contragent) {
      contragent = await prisma.contragent.findUnique({
        where: {
          organizationId_bulstat: {
            organizationId: organization.id,
            bulstat: buyerEik,
          },
        },
        select: { id: true },
      });

      if (!contragent) {
        const buyerFromExternal = await fetchCompanyFromExternalApi(buyerEik);
        const buyerAddress = formatAddressForStorage(
          buyerFromExternal?.address ?? {
            street: invoiceData.buyerAddress || "",
            settlement: invoiceData.buyerCity || "",
          },
        );

        const buyerRegistryId = await upsertCompanyRegistryCache({
          bulstat: buyerEik,
          name: buyerFromExternal?.name || invoiceData.buyerName || buyerEik,
          vatNumber:
            buyerFromExternal?.vatNumber || invoiceData.buyerVatNumber || null,
          address: buyerAddress,
          rawLookupData: buyerFromExternal?.rawLookupData,
        });

        contragent = await prisma.contragent.create({
          data: {
            organizationId: organization.id,
            bulstat: buyerEik,
            name: buyerFromExternal?.name || invoiceData.buyerName || "",
            vatNumber:
              buyerFromExternal?.vatNumber ||
              invoiceData.buyerVatNumber ||
              null,
            molName: buyerFromExternal?.molName || invoiceData.buyerMol || null,
            email: buyerFromExternal?.email || null,
            address: buyerAddress,
            source: buyerFromExternal ? "NAP_API" : "MANUAL",
            registryId: buyerRegistryId,
            rawLookupData:
              buyerFromExternal?.rawLookupData === undefined
                ? null
                : (buyerFromExternal.rawLookupData as any),
          },
          select: { id: true },
        });
      }
    }

    // Ensure we have both organization and contragent after auto-creation
    if (!organization) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "uploader.alerts.organizationCreateFailedHeader",
            message: "uploader.alerts.organizationCreateFailedMessage",
          },
        },
        { status: 422 },
      );
    }

    if (!contragent) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "uploader.alerts.contragentCreateFailedHeader",
            message: "uploader.alerts.contragentCreateFailedMessage",
          },
        },
        { status: 422 },
      );
    }

    // Parse final invoice number with the resolved organization's series prefix
    const { series: invoiceSeries } = parseInvoiceNumber(
      invoiceData.invoiceNumber,
      organization.invoiceSeriesPrefix,
    );

    // ------------------------------------------------------------------
    // Parse dates
    // ------------------------------------------------------------------
    const issueDate = parseBGDate(invoiceData.invoiceDate);
    const taxEventDate = invoiceData.taxEventDate
      ? parseBGDate(invoiceData.taxEventDate)
      : null;

    // ------------------------------------------------------------------
    // Parse financial values
    // ------------------------------------------------------------------
    const subtotal = parseDecimal(invoiceData.subtotal);
    const vatAmount = parseDecimal(invoiceData.vatAmount);
    const totalAmount = parseDecimal(invoiceData.total);

    // ------------------------------------------------------------------
    // Determine exchange rate / original currency if present
    // ------------------------------------------------------------------
    const currency = (invoiceData.currency ?? "BGN").toUpperCase();

    // ------------------------------------------------------------------
    // Upsert everything in a transaction
    // ------------------------------------------------------------------
    const result = await prisma.$transaction(async (tx) => {
      // 1. SourceDocument — represents the original uploaded PDF
      const sourceDoc = await tx.sourceDocument.create({
        data: {
          sourceType: "OTHER",
          originalFileUrl: sourceDocumentUrl || "",
          originalFilename: originalFilename,
          mimeType: "application/pdf",
          status: "CONVERTED",
          parsedData: invoiceData as object,
          organizationId: organization.id,
          uploadedByUserId: dbUser.id,
        },
        select: { id: true },
      });

      // 2. GeneratedInvoice (upsert – if same series/number exists, update it)
      const existingInvoice = await tx.generatedInvoice.findUnique({
        where: {
          organizationId_invoiceSeries_invoiceNumber: {
            organizationId: organization.id,
            invoiceSeries,
            invoiceNumber: invoiceSeq,
          },
        },
        select: { id: true, sourceDocumentId: true },
      });

      let generatedInvoiceId: number;

      if (existingInvoice) {
        // Update existing record (e.g. re-generated)
        const updated = await tx.generatedInvoice.update({
          where: { id: existingInvoice.id },
          data: {
            issueDate,
            taxEventDate,
            currency,
            subtotal,
            vatAmount,
            totalAmount,
            status: "ISSUED",
            // Link source doc only if not already linked
            sourceDocumentId: existingInvoice.sourceDocumentId ?? sourceDoc.id,
          },
          select: { id: true },
        });
        generatedInvoiceId = updated.id;
      } else {
        const created = await tx.generatedInvoice.create({
          data: {
            invoiceSeries,
            invoiceNumber: invoiceSeq,
            issueDate,
            taxEventDate,
            currency,
            subtotal,
            vatAmount,
            totalAmount,
            status: "ISSUED",
            creditsCost: 1, // default
            organizationId: organization.id,
            contragentId: contragent.id,
            sourceDocumentId: sourceDoc.id,
          },
          select: { id: true },
        });
        generatedInvoiceId = created.id;
      }

      // 3. InvoiceLineItems — delete old ones if re-generating, then insert
      await tx.invoiceLineItem.deleteMany({
        where: { generatedInvoiceId },
      });

      if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
        await tx.invoiceLineItem.createMany({
          data: invoiceData.lineItems.map((item) => ({
            generatedInvoiceId,
            description: item.description ?? "",
            quantity: parseDecimal(String(item.quantity)),
            unitPrice: parseDecimal(String(item.unitPrice)),
            vatRate: parseDecimal(String(item.vatPercent)),
            lineTotal: parseDecimal(String(item.value)),
          })),
        });
      }

      // 4. Advance Organization.current_inv_number only forward
      await tx.organization.updateMany({
        where: {
          id: organization.id,
          OR: [
            { current_inv_number: null },
            { current_inv_number: { lt: invoiceSeq } },
          ],
        },
        data: {
          current_inv_number: invoiceSeq,
        },
      });

      return { sourceDocumentId: sourceDoc.id, generatedInvoiceId };
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    console.error("[record-invoice] Error:", error);
    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "errorMessagesCommon.serverErrorHeader",
          message: "errorMessagesCommon.serverErrorMessage",
        },
      },
      { status: 500 },
    );
  }
}
