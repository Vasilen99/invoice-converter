import { prisma } from "../../../../../utility/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";

export async function DELETE(request: NextRequest) {
  const user = await getUserServer();
  if (!user) {
    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "errorMessagesCommon.userNotFoundHeader",
          message: "errorMessagesCommon.userNotFoundMessage",
        },
      },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { organizationId } = body;

    const userAccount = await prisma.accountMember.findFirst({
      where: {
        user: {
          auth_uid: user.sub,
        },
      },
      select: {
        accountId: true,
      },
    });

    if (!userAccount) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "organizationsAlerts.error.accountNotFoundHeader",
            message: "organizationsAlerts.error.accountNotFoundMessage",
          },
        },
        { status: 400 },
      );
    }

    const deletedOrganization = await prisma.organization.delete({
      where: {
        id: organizationId,
      },
    });

    return NextResponse.json(
      {
        data: deletedOrganization,
        alert: {
          status: "success",
          header: "organizationsAlerts.success.deleteSuccessHeader",
          message: "organizationsAlerts.success.deleteSuccessMessage",
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.log("There was a error with deleting the organization:", err);

    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "errorMessagesCommon.deleteErrorHeader",
          message: "organizationsAlerts.error.deleteServerErrorMessage",
        },
      },
      { status: 500 },
    );
  }
}
