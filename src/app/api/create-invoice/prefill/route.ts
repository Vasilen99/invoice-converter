import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../utility/prisma";
import { getUserServer } from "../../../../../utility/get-user-server";
import { notFound } from "next/navigation";
import {
  aggregateInvoicePrefillData,
  buildPrefillResponse,
} from "../../../../utility/helpers";

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

    const [organization, contragent, generatedInvoices] = await Promise.all([
      prisma.organization.findFirst({
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
      return notFound();
    }

    if (!contragent) {
      return notFound();
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

    return NextResponse.json(
      {
        data: prefillData,
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
