import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";
import { BulgarianInvoiceData } from "../../../types";
import { notFound } from "next/navigation";
import {
  extractEmail,
  extractManagerName,
  formatAddressForStorage,
  transformAddressFromCompanyData,
} from "@/utility/company-registry-helpers";
import {
  getTodayForInput,
  parseDateForDatabase,
} from "@/utility/date-formatter";
import {
  fetchExternalCompanyByEik,
  hasRequiredInvoiceFields,
  normalizeEik,
  parseDecimal,
  parseInvoiceNumber,
  sanitizeInvoice,
} from "@/utility/api-helpers";

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
  const external = await fetchExternalCompanyByEik(bulstat);
  if (!external) return null;
  return {
    bulstat: external.bulstat || normalizeEik(bulstat),
    name: external.name,
    vatNumber: external.vatNumber,
    address:
      external.address ??
      transformAddressFromCompanyData(external.rawLookupData),
    molName: external.molName ?? extractManagerName(external.rawLookupData),
    email: external.email ?? extractEmail(external.rawLookupData),
    rawLookupData: external.rawLookupData,
  };
}

async function fetchCompanyFromRegistryCache(
  bulstat: string,
): Promise<RegistryCompanyData | null> {
  const normalizedBulstat = normalizeEik(bulstat);
  if (!normalizedBulstat) return null;

  const cached = await prisma.companyRegistryCache.findUnique({
    where: { bulstat: normalizedBulstat },
    select: {
      bulstat: true,
      name: true,
      vatNumber: true,
      address: true,
      rawLookupData: true,
      lastFetchedAt: true,
    },
  });

  if (!cached) return null;

  await prisma.companyRegistryCache.update({
    where: { bulstat: normalizedBulstat },
    data: { lastFetchedAt: new Date() },
  });

  const rawLookupData = cached.rawLookupData as any;
  const derivedAddress = rawLookupData
    ? transformAddressFromCompanyData(rawLookupData)
    : undefined;

  return {
    bulstat: cached.bulstat,
    name: cached.name,
    vatNumber: cached.vatNumber,
    address: (cached.address as ReturnType<
      typeof transformAddressFromCompanyData
    >) ??
      derivedAddress ?? { street: "", settlement: "" },
    molName: rawLookupData ? extractManagerName(rawLookupData) : "",
    email: rawLookupData ? extractEmail(rawLookupData) : null,
    rawLookupData: cached.rawLookupData,
  };
}

async function resolveCompanyDataByBulstat(
  bulstat: string,
): Promise<RegistryCompanyData | null> {
  const normalizedBulstat = normalizeEik(bulstat);
  if (!normalizedBulstat) return null;

  const fromCache = await fetchCompanyFromRegistryCache(normalizedBulstat);
  if (fromCache) return fromCache;

  return fetchCompanyFromExternalApi(normalizedBulstat);
}

async function createCompanyRegistryCache(input: {
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
      generatedPdfUrl?: string | null;
      skipSourceDocumentCreation?: boolean;
    };

    const {
      invoiceData,
      originalFilename = "",
      sourceDocumentUrl = null,
      generatedPdfUrl = null,
      skipSourceDocumentCreation = false,
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

    const normalizedInvoice = sanitizeInvoice(invoiceData);

    if (!hasRequiredInvoiceFields(normalizedInvoice)) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "uploader.alerts.requiredInvoiceFieldsHeader",
            message: "uploader.alerts.requiredInvoiceFieldsMessage",
          },
        },
        { status: 400 },
      );
    }

    const sellerEik = normalizeEik(normalizedInvoice.sellerEik);
    const buyerEik = normalizeEik(normalizedInvoice.buyerEik);

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
      normalizedInvoice.invoiceNumber,
      defaultSeriesPrefix,
    );

    // Auto-create organization if it doesn't exist
    if (!organization && sellerEik) {
      const sellerResolved = await resolveCompanyDataByBulstat(sellerEik);
      const sellerAddress = formatAddressForStorage(
        sellerResolved?.address ?? {
          street: normalizedInvoice.sellerAddress || "",
          settlement: normalizedInvoice.sellerCity || "",
        },
      );

      const registryId = await createCompanyRegistryCache({
        bulstat: sellerEik,
        name: sellerResolved?.name || normalizedInvoice.sellerName || sellerEik,
        vatNumber:
          sellerResolved?.vatNumber ||
          normalizedInvoice.sellerVatNumber ||
          null,
        address: sellerAddress,
        rawLookupData: sellerResolved?.rawLookupData,
      });

      organization = await prisma.organization.create({
        data: {
          accountId: accountMember.accountId,
          bulstat: sellerEik,
          name: sellerResolved?.name || normalizedInvoice.sellerName || "",
          vatNumber:
            sellerResolved?.vatNumber ||
            normalizedInvoice.sellerVatNumber ||
            null,
          molName:
            sellerResolved?.molName || normalizedInvoice.sellerMol || null,
          email: sellerResolved?.email || null,
          address: sellerAddress,
          invoiceSeriesPrefix: "INV",
          current_inv_number: invoiceSeq,
          source: sellerResolved ? "NAP_API" : "MANUAL",
          registryId,
        },
        select: {
          id: true,
          invoiceSeriesPrefix: true,
        },
      });

      if (buyerEik) {
        const buyerResolved = await resolveCompanyDataByBulstat(buyerEik);
        const buyerAddress = formatAddressForStorage(
          buyerResolved?.address ?? {
            street: normalizedInvoice.buyerAddress || "",
            settlement: normalizedInvoice.buyerCity || "",
          },
        );

        const buyerRegistryId = await createCompanyRegistryCache({
          bulstat: buyerEik,
          name: buyerResolved?.name || normalizedInvoice.buyerName || buyerEik,
          vatNumber:
            buyerResolved?.vatNumber ||
            normalizedInvoice.buyerVatNumber ||
            null,
          address: buyerAddress,
          rawLookupData: buyerResolved?.rawLookupData,
        });

        contragent = await prisma.contragent.create({
          data: {
            organizationId: organization.id,
            bulstat: buyerEik,
            name: buyerResolved?.name || normalizedInvoice.buyerName || "",
            vatNumber:
              buyerResolved?.vatNumber ||
              normalizedInvoice.buyerVatNumber ||
              null,
            molName:
              buyerResolved?.molName || normalizedInvoice.buyerMol || null,
            email: buyerResolved?.email || null,
            address: buyerAddress,
            source: buyerResolved ? "NAP_API" : "MANUAL",
            registryId: buyerRegistryId,
            rawLookupData:
              buyerResolved?.rawLookupData === undefined
                ? null
                : (buyerResolved.rawLookupData as any),
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
        const buyerResolved = await resolveCompanyDataByBulstat(buyerEik);
        const buyerAddress = formatAddressForStorage(
          buyerResolved?.address ?? {
            street: normalizedInvoice.buyerAddress || "",
            settlement: normalizedInvoice.buyerCity || "",
          },
        );

        const buyerRegistryId = await createCompanyRegistryCache({
          bulstat: buyerEik,
          name: buyerResolved?.name || normalizedInvoice.buyerName || buyerEik,
          vatNumber:
            buyerResolved?.vatNumber ||
            normalizedInvoice.buyerVatNumber ||
            null,
          address: buyerAddress,
          rawLookupData: buyerResolved?.rawLookupData,
        });

        contragent = await prisma.contragent.create({
          data: {
            organizationId: organization.id,
            bulstat: buyerEik,
            name: buyerResolved?.name || normalizedInvoice.buyerName || "",
            vatNumber:
              buyerResolved?.vatNumber ||
              normalizedInvoice.buyerVatNumber ||
              null,
            molName:
              buyerResolved?.molName || normalizedInvoice.buyerMol || null,
            email: buyerResolved?.email || null,
            address: buyerAddress,
            source: buyerResolved ? "NAP_API" : "MANUAL",
            registryId: buyerRegistryId,
            rawLookupData:
              buyerResolved?.rawLookupData === undefined
                ? null
                : (buyerResolved.rawLookupData as any),
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
      normalizedInvoice.invoiceNumber,
      organization.invoiceSeriesPrefix,
    );

    // ------------------------------------------------------------------
    // Parse dates
    // ------------------------------------------------------------------
    const issueDate =
      parseDateForDatabase(normalizedInvoice.invoiceDate) ??
      parseDateForDatabase(getTodayForInput()) ??
      new Date();
    const taxEventDate =
      parseDateForDatabase(normalizedInvoice.taxEventDate) ?? issueDate;

    // ------------------------------------------------------------------
    // Parse financial values
    // ------------------------------------------------------------------
    const subtotal = parseDecimal(normalizedInvoice.subtotal);
    const vatAmount = parseDecimal(normalizedInvoice.vatAmount);
    const totalAmount = parseDecimal(normalizedInvoice.total);

    // ------------------------------------------------------------------
    // Determine exchange rate / original currency if present
    // ------------------------------------------------------------------
    const currency = (normalizedInvoice.currency ?? "EUR").toUpperCase();

    // ------------------------------------------------------------------
    // Upsert everything in a transaction
    // ------------------------------------------------------------------
    const result = await prisma.$transaction(async (tx) => {
      // 1. SourceDocument — represents the original uploaded PDF (skip if requested)
      let sourceDocId: number | null = null;

      if (!skipSourceDocumentCreation) {
        const sourceDoc = await tx.sourceDocument.create({
          data: {
            sourceType: "OTHER",
            originalFileUrl: sourceDocumentUrl || "",
            originalFilename: originalFilename,
            mimeType: "application/pdf",
            status: "CONVERTED",
            parsedData: normalizedInvoice as object,
            organizationId: organization.id,
            uploadedByUserId: dbUser.id,
          },
          select: { id: true },
        });
        sourceDocId = sourceDoc.id;
      }

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
            pdfFileUrl: generatedPdfUrl || undefined,
            // Link source doc only if not already linked and we created one
            sourceDocumentId:
              existingInvoice.sourceDocumentId ?? sourceDocId ?? undefined,
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
            pdfFileUrl: generatedPdfUrl || undefined,
            creditsCost: 1, // default
            organizationId: organization.id,
            contragentId: contragent.id,
            sourceDocumentId: sourceDocId ?? undefined,
          },
          select: { id: true },
        });
        generatedInvoiceId = created.id;
      }

      // 3. InvoiceLineItems — delete old ones if re-generating, then insert
      await tx.invoiceLineItem.deleteMany({
        where: { generatedInvoiceId },
      });

      if (
        normalizedInvoice.lineItems &&
        normalizedInvoice.lineItems.length > 0
      ) {
        await tx.invoiceLineItem.createMany({
          data: normalizedInvoice.lineItems.map((item) => ({
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

      return { sourceDocumentId: sourceDocId, generatedInvoiceId };
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
