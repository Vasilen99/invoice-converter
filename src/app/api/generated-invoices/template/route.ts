import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getUserServer } from "../../../../../utility/get-user-server";
import { prisma } from "../../../../../utility/prisma";
import {
  generateNextInvoiceNumber,
  parseJsonAddress,
} from "../../../../utility/helpers";

type ParsedInvoiceData = {
  location?: string;
  bank?: string;
  iban?: string;
  bic?: string;
};

function buildInvoiceDisplayNumber(series: string, sequence: number): string {
  return `${series}${String(sequence).padStart(10, "0")}`;
}

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function pickFirstFilled(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

export async function GET(request: NextRequest) {
  const user = await getUserServer();
  if (!user?.sub) {
    return notFound();
  }

  try {
    const invoiceId = Number(request.nextUrl.searchParams.get("invoiceId"));
    if (!invoiceId) {
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
        account: {
          select: {
            composer_name: true,
          },
        },
      },
    });

    if (!accountMember) {
      return notFound();
    }

    const invoice = await prisma.generatedInvoice.findFirst({
      where: {
        id: invoiceId,
        organization: {
          accountId: accountMember.accountId,
        },
      },
      select: {
        id: true,
        invoiceSeries: true,
        invoiceNumber: true,
        issueDate: true,
        taxEventDate: true,
        currency: true,
        organization: {
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
        },
        contragent: {
          select: {
            id: true,
            name: true,
            bulstat: true,
            vatNumber: true,
            molName: true,
            address: true,
          },
        },
        lineItems: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            vatRate: true,
            lineTotal: true,
          },
        },
        sourceDocument: {
          select: {
            parsedData: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "errorMessagesCommon.serverErrorHeader",
            message: "errorMessagesCommon.serverErrorMessage",
          },
        },
        { status: 404 },
      );
    }

    const parsedData = (invoice.sourceDocument?.parsedData ??
      null) as ParsedInvoiceData | null;
    const organizationAddress = parseJsonAddress(invoice.organization.address);
    const contragentAddress = parseJsonAddress(invoice.contragent.address);

    const sourceInvoiceNumber = buildInvoiceDisplayNumber(
      invoice.invoiceSeries,
      invoice.invoiceNumber,
    );

    const invoiceNumberSuggestion = generateNextInvoiceNumber(
      invoice.organization.invoiceSeriesPrefix,
      invoice.organization.current_inv_number?.toString() ?? null,
    );

    const location = pickFirstFilled(
      parsedData?.location,
      organizationAddress?.settlement,
    );

    const bank = pickFirstFilled(parsedData?.bank, invoice.organization.bank);
    const iban = pickFirstFilled(parsedData?.iban, invoice.organization.iban);
    const bic = pickFirstFilled(parsedData?.bic, invoice.organization.bic);

    const locationOptions = [
      parsedData?.location?.trim() || "",
      organizationAddress?.settlement?.trim() || "",
    ].filter((value, index, source) => {
      if (!value) return false;
      return source.indexOf(value) === index;
    });

    const bankOptionsMap = new Map<
      string,
      { bank: string; iban: string; bic: string }
    >();
    const upsertBankOption = (candidate: {
      bank?: string | null;
      iban?: string | null;
      bic?: string | null;
    }) => {
      const normalized = {
        bank: candidate.bank?.trim() || "",
        iban: candidate.iban?.trim() || "",
        bic: candidate.bic?.trim() || "",
      };

      if (!normalized.bank && !normalized.iban && !normalized.bic) {
        return;
      }

      const key = `${normalized.bank}|${normalized.iban}|${normalized.bic}`;
      bankOptionsMap.set(key, normalized);
    };

    upsertBankOption({
      bank: parsedData?.bank,
      iban: parsedData?.iban,
      bic: parsedData?.bic,
    });
    upsertBankOption({
      bank: invoice.organization.bank,
      iban: invoice.organization.iban,
      bic: invoice.organization.bic,
    });

    return NextResponse.json(
      {
        data: {
          sourceInvoice: {
            id: invoice.id,
            sourceInvoiceNumber,
          },
          invoiceNumberSuggestion,
          invoiceDate: toDateInputValue(invoice.issueDate),
          taxEventDate: toDateInputValue(invoice.taxEventDate),
          currency: invoice.currency,
          location,
          locationOptions,
          bank,
          iban,
          bic,
          bankOptions: Array.from(bankOptionsMap.values()),
          lineItems: invoice.lineItems.map((lineItem) => ({
            description: lineItem.description,
            unit: "бр.",
            quantity: lineItem.quantity.toString(),
            unitPrice: lineItem.unitPrice.toString(),
            vatPercent: lineItem.vatRate.toString(),
            value: lineItem.lineTotal.toString(),
          })),
          organization: {
            id: invoice.organization.id,
            name: invoice.organization.name,
            bulstat: invoice.organization.bulstat,
            vatNumber: invoice.organization.vatNumber,
            molName: invoice.organization.molName,
            address: organizationAddress,
            bank: invoice.organization.bank,
            iban: invoice.organization.iban,
            bic: invoice.organization.bic,
          },
          contragent: {
            id: invoice.contragent.id,
            name: invoice.contragent.name,
            bulstat: invoice.contragent.bulstat,
            vatNumber: invoice.contragent.vatNumber,
            molName: invoice.contragent.molName,
            address: contragentAddress,
          },
          composerName: accountMember.account.composer_name,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[generated-invoices/template] Error:", error);
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
