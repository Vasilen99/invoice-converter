import { NextRequest } from "next/server";
import { prisma } from "@/utility/prisma";
import {
  aggregateInvoicePrefillData,
  buildPrefillResponse,
} from "@/utility/helpers/api-helpers";
import {
  apiResponse,
  resolveAuthenticatedAccountContext,
} from "@/utility/helpers/server-api";

export async function GET(request: NextRequest) {
  try {
    const accountContext = await resolveAuthenticatedAccountContext();
    if (!accountContext) {
      return apiResponse(null, 401, {
        status: "error",
        header: "errorMessagesCommon.unauthorizedErrorHeader",
        message: "errorMessagesCommon.unauthorizedErrorMessage",
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = Number(searchParams.get("organizationId"));
    const contragentId = Number(searchParams.get("contragentId"));

    if (!organizationId || !contragentId) {
      return apiResponse(null, 400, {
        status: "error",
        header: "errorMessagesCommon.serverErrorHeader",
        message: "errorMessagesCommon.serverErrorMessage",
      });
    }

    const [organization, contragent, generatedInvoices] = await Promise.all([
      prisma.organization.findFirst({
        where: {
          id: organizationId,
          accountId: accountContext.accountId,
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
      }),
      prisma.contragent.findFirst({
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
      }),
      prisma.generatedInvoice.findMany({
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
      }),
    ]);

    if (!organization) {
      return apiResponse(null, 404, {
        status: "error",
        header: "errorMessagesCommon.serverErrorHeader",
        message: "errorMessagesCommon.serverErrorMessage",
      });
    }

    if (!contragent) {
      return apiResponse(null, 404, {
        status: "error",
        header: "errorMessagesCommon.serverErrorHeader",
        message: "errorMessagesCommon.serverErrorMessage",
      });
    }

    // Convert Prisma Decimal/JsonValue types to compatible formats
    const convertedInvoices = generatedInvoices.map((invoice) => ({
      lineItems: invoice.lineItems.map((item) => ({
        ...item,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        vatRate: item.vatRate.toString(),
      })),
      sourceDocument: invoice.sourceDocument
        ? {
            parsedData: invoice.sourceDocument.parsedData as unknown,
          }
        : null,
    }));

    // Convert current_inv_number for response building
    const convertedOrganization = {
      ...organization,
      current_inv_number: organization.current_inv_number
        ? organization.current_inv_number.toString()
        : null,
    };

    // Aggregate prefill data from invoices
    const aggregatedData = aggregateInvoicePrefillData(convertedInvoices);

    // Build response with aggregated data
    const prefillData = buildPrefillResponse(
      convertedOrganization,
      contragent,
      aggregatedData,
    );

    return apiResponse(prefillData, 200);
  } catch (error) {
    console.error("[create-invoice/prefill] Error:", error);
    return apiResponse(null, 500, {
      status: "error",
      header: "errorMessagesCommon.serverErrorHeader",
      message: "errorMessagesCommon.serverErrorMessage",
    });
  }
}
