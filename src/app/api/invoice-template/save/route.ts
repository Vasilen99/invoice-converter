import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "@/utility/get-user-server";
import { prisma } from "@/utility/prisma";
import {
  getDefaultInvoiceTemplateHtml,
  normalizeTemplateHtml,
  sanitizeTemplateHtml,
} from "@/utility/invoice-template";

const TEMPLATE_MAX_LENGTH = 250_000;

export async function POST(req: NextRequest) {
  try {
    const user = await getUserServer();
    if (!user?.sub) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "errorMessagesCommon.unauthorizedErrorHeader",
            message: "errorMessagesCommon.unauthorizedErrorMessage",
          },
        },
        { status: 401 },
      );
    }

    const body = await req.json();
    const incomingTemplate =
      typeof body?.template === "string" ? body.template : "";
    const sanitized = sanitizeTemplateHtml(incomingTemplate);
    const normalized = normalizeTemplateHtml(sanitized);
    const templateToSave = normalized || getDefaultInvoiceTemplateHtml();

    if (templateToSave.length > TEMPLATE_MAX_LENGTH) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "invoiceTemplate.alerts.templateTooLargeHeader",
            message: "invoiceTemplate.alerts.templateTooLargeMessage",
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

    if (!accountMember?.accountId) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "invoiceTemplate.alerts.accountMissingHeader",
            message: "invoiceTemplate.alerts.accountMissingMessage",
          },
        },
        { status: 400 },
      );
    }

    const updatedAccount = await prisma.account.update({
      where: {
        id: accountMember.accountId,
      },
      data: {
        inv_template: templateToSave,
      },
      select: {
        id: true,
        inv_template: true,
      },
    });

    return NextResponse.json(
      {
        data: updatedAccount,
        alert: {
          status: "success",
          header: "invoiceTemplate.alerts.saveSuccessHeader",
          message: "invoiceTemplate.alerts.saveSuccessMessage",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Invoice template save error:", error);
    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "invoiceTemplate.alerts.saveFailedHeader",
          message: "invoiceTemplate.alerts.saveFailedMessage",
        },
      },
      { status: 500 },
    );
  }
}
