import type { BulgarianInvoiceData } from "@/types";
import { prisma } from "@/utility/prisma";
import {
  generateNextInvoiceNumber,
  parseJsonAddress,
  sanitizeInvoice,
} from "@/utility/api-helpers";
import { getTodayForInput } from "@/utility/date-formatter";

type ParsedInvoiceData = {
  location?: string;
  bank?: string;
  iban?: string;
  bic?: string;
};

type BuildLatestTemplateInvoiceInput = {
  accountId: number;
  organizationId: number;
  composerName: string | null;
};

type LatestTemplateInvoiceResult = {
  invoice: BulgarianInvoiceData;
  sourceInvoiceId: number;
};

function pickFirstFilled(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

export async function buildLatestTemplateInvoice(
  input: BuildLatestTemplateInvoiceInput,
): Promise<LatestTemplateInvoiceResult | null> {
  const latestInvoice = await prisma.generatedInvoice.findFirst({
    where: {
      organizationId: input.organizationId,
      organization: {
        accountId: input.accountId,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      taxEventDate: true,
      currency: true,
      organization: {
        select: {
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
    take: 1,
  });

  if (!latestInvoice) {
    return null;
  }

  const today = getTodayForInput();
  const parsedData = (latestInvoice.sourceDocument?.parsedData ??
    null) as ParsedInvoiceData | null;
  const organizationAddress = parseJsonAddress(
    latestInvoice.organization.address,
  );
  const contragentAddress = parseJsonAddress(latestInvoice.contragent.address);

  const invoiceNumber = generateNextInvoiceNumber(
    latestInvoice.organization.invoiceSeriesPrefix,
    latestInvoice.organization.current_inv_number?.toString() ?? null,
  );

  const mapped = sanitizeInvoice({
    invoiceNumber,
    invoiceDate: today,
    taxEventDate: latestInvoice.taxEventDate ? today : today,
    location: pickFirstFilled(
      parsedData?.location,
      organizationAddress?.settlement,
    ),
    sellerName: latestInvoice.organization.name,
    sellerEik: latestInvoice.organization.bulstat ?? "",
    sellerVatNumber: latestInvoice.organization.vatNumber ?? "",
    sellerCity: organizationAddress?.settlement ?? "",
    sellerAddress: organizationAddress?.street ?? "",
    sellerMol: latestInvoice.organization.molName ?? "",
    buyerName: latestInvoice.contragent.name,
    buyerEik: latestInvoice.contragent.bulstat ?? "",
    buyerVatNumber: latestInvoice.contragent.vatNumber ?? "",
    buyerCity: contragentAddress?.settlement ?? "",
    buyerAddress: contragentAddress?.street ?? "",
    buyerMol: latestInvoice.contragent.molName ?? "",
    lineItems: latestInvoice.lineItems.map((lineItem) => ({
      description: lineItem.description,
      unit: "бр.",
      quantity: lineItem.quantity.toString(),
      unitPrice: lineItem.unitPrice.toString(),
      vatPercent: lineItem.vatRate.toString(),
      value: lineItem.lineTotal.toString(),
    })),
    subtotal: "",
    vatAmount: "",
    total: "",
    totalInWords: "",
    currency: latestInvoice.currency,
    composer_name: input.composerName ?? "",
    bank: pickFirstFilled(parsedData?.bank, latestInvoice.organization.bank),
    iban: pickFirstFilled(parsedData?.iban, latestInvoice.organization.iban),
    bic: pickFirstFilled(parsedData?.bic, latestInvoice.organization.bic),
  });

  return {
    invoice: mapped,
    sourceInvoiceId: latestInvoice.id,
  };
}
