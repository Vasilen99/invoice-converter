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
          header: "errorMessagesCommon.unauthorizedErrorHeader",
          message: "errorMessagesCommon.unauthorizedErrorMessage",
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
            header: "organizations.accountNotFoundHeader",
            message: "organizations.accountNotFoundMessage",
          },
        },
        { status: 400 },
      );
    }

    const deletedOrganization = await prisma.organization.delete({
      where: {
        id: organizationId,
        accountId: userAccount.accountId,
      },
    });

    return NextResponse.json(
      {
        data: deletedOrganization,
        alert: {
          status: "success",
          header: "organizations.deleteSuccessHeader",
          message: "organizations.deleteSuccessMessage",
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Error deleting organization:", err);

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
