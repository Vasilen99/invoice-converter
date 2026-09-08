import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../utility/prisma";
import { getUserServer } from "../../../../../utility/get-user-server";
import { notFound } from "next/navigation";

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

function parseJsonAddress(
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

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : fallback;
  if (typeof value !== "string") return fallback;

  const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const user = await getUserServer();
  if (!user?.sub) {
    return notFound();
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = Number(searchParams.get("organizationId"));
    const contragentId = Number(searchParams.get("contragentId"));

    if (!organizationId || !contragentId) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "errorMessagesCommon.serverErrorHeader",
            message: "errorMessagesCommon.serverErrorMessage",
          },
        },
        { status: 400 },
      );
    }

    const accountMember = await prisma.accountMember.findFirst({
      where: {
        user: {
          auth_uid: user.sub,
        },
      },
      select: {
        accountId: true,
      },
    });

    if (!accountMember) {
      return notFound();
    }

    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        accountId: accountMember.accountId,
      },
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
      },
    });

    if (!organization) {
      return notFound();
    }

    const contragent = await prisma.contragent.findFirst({
      where: {
        id: contragentId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        bulstat: true,
        vatNumber: true,
        molName: true,
        address: true,
      },
    });

    if (!contragent) {
      return notFound();
    }

    const generatedInvoices = await prisma.generatedInvoice.findMany({
      where: {
        organizationId,
        contragentId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      select: {
        lineItems: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            vatRate: true,
          },
        },
        sourceDocument: {
          select: {
            parsedData: true,
          },
        },
      },
    });

    const lineItemTemplateMap = new Map<
      string,
      {
        description: string;
        unit: string;
        quantity: string;
        unitPrice: string;
        vatPercent: string;
      }
    >();

    const locationSet = new Set<string>();
    const bankMap = new Map<
      string,
      { bank: string; iban: string; bic: string }
    >();

    for (const invoice of generatedInvoices) {
      const parsedData = invoice.sourceDocument
        ?.parsedData as ParsedInvoiceData | null;

      for (const lineItem of invoice.lineItems) {
        const description = (lineItem.description ?? "").trim();
        if (!description) continue;

        const unitPrice = Number(lineItem.unitPrice).toFixed(2);
        const vatPercent = Number(lineItem.vatRate).toFixed(2);
        const key = `${description}|${unitPrice}|${vatPercent}`;

        if (!lineItemTemplateMap.has(key)) {
          lineItemTemplateMap.set(key, {
            description,
            unit: "бр.",
            quantity: Number(lineItem.quantity).toFixed(2),
            unitPrice,
            vatPercent,
          });
        }
      }

      if (parsedData?.lineItems && Array.isArray(parsedData.lineItems)) {
        for (const parsedLineItem of parsedData.lineItems) {
          const description = (parsedLineItem.description ?? "").trim();
          if (!description) continue;

          const unitPrice = toNumber(parsedLineItem.unitPrice).toFixed(2);
          const vatPercent = toNumber(parsedLineItem.vatPercent).toFixed(2);
          const key = `${description}|${unitPrice}|${vatPercent}`;

          if (!lineItemTemplateMap.has(key)) {
            lineItemTemplateMap.set(key, {
              description,
              unit: (parsedLineItem.unit ?? "бр.").trim() || "бр.",
              quantity: toNumber(parsedLineItem.quantity, 1).toFixed(2),
              unitPrice,
              vatPercent,
            });
          }
        }
      }

      const location = parsedData?.location?.trim();
      if (location) {
        locationSet.add(location);
      }

      const bank = parsedData?.bank?.trim() ?? "";
      const iban = parsedData?.iban?.trim() ?? "";
      const bic = parsedData?.bic?.trim() ?? "";

      if (bank || iban || bic) {
        bankMap.set(`${bank}|${iban}|${bic}`, { bank, iban, bic });
      }
    }

    if (organization.bank || organization.iban || organization.bic) {
      const bank = organization.bank?.trim() ?? "";
      const iban = organization.iban?.trim() ?? "";
      const bic = organization.bic?.trim() ?? "";
      bankMap.set(`${bank}|${iban}|${bic}`, { bank, iban, bic });
    }

    const invoiceSeries = organization.invoiceSeriesPrefix || "INV";
    const currentNumber = organization.current_inv_number
      ? Number(organization.current_inv_number)
      : 0;
    const nextInvoiceNumber = Math.max(currentNumber + 1, 1);

    return NextResponse.json(
      {
        data: {
          invoiceNumberSuggestion: `${invoiceSeries}${String(nextInvoiceNumber).padStart(10, "0")}`,
          organization: {
            ...organization,
            address: parseJsonAddress(organization.address),
          },
          contragent: {
            ...contragent,
            address: parseJsonAddress(contragent.address),
          },
          lineItemTemplates: Array.from(lineItemTemplateMap.values()),
          locationOptions: Array.from(locationSet),
          bankOptions: Array.from(bankMap.values()),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[create-invoice/prefill] Error:", error);
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
