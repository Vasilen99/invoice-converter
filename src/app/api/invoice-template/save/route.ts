import { NextRequest } from "next/server";
import { prisma } from "@/utility/prisma";
import {
  getDefaultInvoiceTemplateHtml,
  normalizeTemplateHtml,
  sanitizeTemplateHtml,
} from "@/utility/invoice-template";
import {
  apiResponse,
  resolveAuthenticatedAccountContext,
} from "@/utility/helpers/server-api";

export async function POST(req: NextRequest) {
  try {
    const accountContext = await resolveAuthenticatedAccountContext();
    if (!accountContext) {
      return apiResponse(null, 401, {
        status: "error",
        header: "errorMessagesCommon.unauthorizedErrorHeader",
        message: "errorMessagesCommon.unauthorizedErrorMessage",
      });
    }

    const body = await req.json();
    const incomingTemplate =
      typeof body?.template === "string" ? body.template : "";
    const sanitized = sanitizeTemplateHtml(incomingTemplate);
    const normalized = normalizeTemplateHtml(sanitized);
    const templateToSave = normalized || getDefaultInvoiceTemplateHtml();

    const account = await prisma.account.findUnique({
      where: {
        id: accountContext.accountId,
      },
      select: {
        id: true,
      },
    });

    if (!account?.id) {
      return apiResponse(null, 400, {
        status: "error",
        header: "invoiceTemplate.alerts.accountMissingHeader",
        message: "invoiceTemplate.alerts.accountMissingMessage",
      });
    }

    const updatedAccount = await prisma.account.update({
      where: {
        id: accountContext.accountId,
      },
      data: {
        inv_template: templateToSave,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        inv_template: true,
      },
    });

    return apiResponse(updatedAccount, 200, {
      status: "success",
      header: "invoiceTemplate.alerts.saveSuccessHeader",
      message: "invoiceTemplate.alerts.saveSuccessMessage",
    });
  } catch (error) {
    console.error("Invoice template save error:", error);
    return apiResponse(null, 500, {
      status: "error",
      header: "invoiceTemplate.alerts.saveFailedHeader",
      message: "invoiceTemplate.alerts.saveFailedMessage",
    });
  }
}
