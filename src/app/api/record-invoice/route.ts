import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";
import { BulgarianInvoiceData } from "../../../types";
import { notFound } from "next/navigation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeBulstat(value: string | undefined | null): string {
  return (value ?? "").trim();
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

/**
 * Split an invoice number string such as "INV-001" or "ФАК 0012" into its
 * alphabetic series and numeric sequence parts.
 *
 * Examples:
 *   "INV-001"   → { series: "INV", seq: 1 }
 *   "ФАК-0012"  → { series: "ФАК", seq: 12 }
 *   "1234"      → { series: defaultSeries, seq: 1234 }
 */
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
    };

    const { invoiceData, originalFilename = "invoice.pdf" } = body;

    if (!invoiceData) {
      return NextResponse.json(
        { error: "invoiceData is required" },
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
      return NextResponse.json(
        {
          status: "error",
          header: "organizations.accountNotFoundHeader",
          message: "organizations.accountNotFoundMessage",
        },
        { status: 404 },
      );
    }

    // ------------------------------------------------------------------
    // Resolve organization (seller) by bulstat within this account
    // ------------------------------------------------------------------
    const sellerEik = normalizeBulstat(invoiceData.sellerEik);

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
    const buyerEik = normalizeBulstat(invoiceData.buyerEik);

    let contragent = null;
    if (organization && buyerEik) {
      // Use upsert to avoid race conditions on concurrent requests
      contragent = await prisma.contragent.upsert({
        where: {
          organizationId_bulstat: {
            organizationId: organization.id,
            bulstat: buyerEik,
          },
        },
        update: {},
        create: {
          organizationId: organization.id,
          bulstat: buyerEik,
          name: invoiceData.buyerName || "",
          vatNumber: invoiceData.buyerVatNumber || null,
          address: {
            street: invoiceData.buyerAddress || "",
            city: invoiceData.buyerCity || "",
          },
          source: "MANUAL",
        },
        select: { id: true },
      });
    }

    // Parse invoice number early to extract numeric sequence
    // We'll use this for organization current_inv_number updates/creation.
    const defaultSeriesPrefix = "INV";
    const { seq: invoiceSeq } = parseInvoiceNumber(
      invoiceData.invoiceNumber,
      defaultSeriesPrefix,
    );

    // Auto-create organization if it doesn't exist
    if (!organization && sellerEik) {
      organization = await prisma.organization.create({
        data: {
          accountId: accountMember.accountId,
          bulstat: sellerEik,
          name: invoiceData.sellerName || "",
          vatNumber: invoiceData.sellerVatNumber || null,
          address: {
            street: invoiceData.sellerAddress || "",
            city: invoiceData.sellerCity || "",
          },
          invoiceSeriesPrefix: "INV",
          current_inv_number: invoiceSeq,
          source: "MANUAL",
        },
        select: {
          id: true,
          invoiceSeriesPrefix: true,
        },
      });

      // Now upsert the contragent for this newly created organization
      if (buyerEik) {
        contragent = await prisma.contragent.upsert({
          where: {
            organizationId_bulstat: {
              organizationId: organization.id,
              bulstat: buyerEik,
            },
          },
          update: {},
          create: {
            organizationId: organization.id,
            bulstat: buyerEik,
            name: invoiceData.buyerName || "",
            vatNumber: invoiceData.buyerVatNumber || null,
            address: {
              street: invoiceData.buyerAddress || "",
              city: invoiceData.buyerCity || "",
            },
          },
          select: { id: true },
        });
      }
    }

    // Ensure we have both organization and contragent after auto-creation
    if (!organization) {
      return NextResponse.json(
        {
          error:
            "Seller organization could not be created. Invalid seller EIK.",
        },
        { status: 422 },
      );
    }

    if (!contragent) {
      return NextResponse.json(
        {
          error: "Buyer contragent could not be created. Invalid buyer EIK.",
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
          originalFileUrl: "", // no persistent storage URL in this flow
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

      // 4. Update Organization.current_inv_number with the numeric sequence
      await tx.organization.update({
        where: { id: organization.id },
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
      { error: "Failed to record invoice" },
      { status: 500 },
    );
  }
}
