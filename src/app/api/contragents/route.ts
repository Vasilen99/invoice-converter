import { prisma } from "@/utility/prisma";
import { NextRequest } from "next/server";
import {
  apiResponse,
  resolveAuthenticatedAccountContext,
} from "@/utility/helpers/server-api";
export async function GET(req: NextRequest) {
  try {
    const accountContext = await resolveAuthenticatedAccountContext();
    if (!accountContext) {
      return apiResponse(null, 401, {
        status: "error",
        header: "errorMessagesCommon.unauthorizedErrorHeader",
        message: "errorMessagesCommon.unauthorizedErrorMessage",
      });
    }

    const searchParams = req.nextUrl.searchParams;
    const organizationId = searchParams.get("organizationId");

    const parsedOrganizationId = Number(organizationId);

    if (!organizationId || !Number.isFinite(parsedOrganizationId)) {
      return apiResponse(null, 400, {
        status: "error",
        header: "createInvoice.errors.missingOrganizationId",
        message: "createInvoice.errors.missingOrganizationIdDescription",
      });
    }

    const userContragents = await prisma.contragent.findMany({
      where: {
        organization: {
          id: parsedOrganizationId,
          accountId: accountContext.accountId,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    return apiResponse(userContragents, 200);
  } catch (_er) {
    return apiResponse(null, 500, {
      status: "error",
      header: "createInvoice.errors.serverErrorHeaderFetchContragents",
      message: "createInvoice.errors.serverErrorDescriptionFetchContragents",
    });
  }
}
