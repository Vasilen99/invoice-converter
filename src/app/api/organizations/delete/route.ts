import { prisma } from "@/utility/prisma";
import { NextRequest } from "next/server";
import {
  apiResponse,
  resolveAuthenticatedAccountContext,
} from "@/utility/helpers/server-api";

export async function DELETE(request: NextRequest) {
  try {
    const accountContext = await resolveAuthenticatedAccountContext();
    if (!accountContext) {
      return apiResponse(null, 401, {
        status: "error",
        header: "errorMessagesCommon.unauthorizedErrorHeader",
        message: "errorMessagesCommon.unauthorizedErrorMessage",
      });
    }

    const body = await request.json();
    const { organizationId } = body;

    const account = await prisma.account.findUnique({
      where: { id: accountContext.accountId },
      select: { id: true },
    });

    if (!account) {
      return apiResponse(null, 400, {
        status: "error",
        header: "organizations.accountNotFoundHeader",
        message: "organizations.accountNotFoundMessage",
      });
    }

    const deletedOrganization = await prisma.organization.delete({
      where: {
        id: organizationId,
        accountId: accountContext.accountId,
      },
    });

    return apiResponse(deletedOrganization, 200, {
      status: "success",
      header: "organizations.deleteSuccessHeader",
      message: "organizations.deleteSuccessMessage",
    });
  } catch (err) {
    console.error("Error deleting organization:", err);

    return apiResponse(null, 500, {
      status: "error",
      header: "errorMessagesCommon.serverErrorHeader",
      message: "errorMessagesCommon.serverErrorMessage",
    });
  }
}
