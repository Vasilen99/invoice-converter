import { prisma } from "../../../../../utility/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";
import { notFound } from "next/navigation";

export async function DELETE(request: NextRequest) {
  const user = await getUserServer();
  if (!user) {
    return notFound();
  }

  try {
    const body = await request.json();
    const { contragentId } = body;

    // Get user data
    const userData = await prisma.user.findUnique({
      where: {
        auth_uid: user.sub,
      },
      select: {
        id: true,
      },
    });

    if (!userData) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "contragents.accountNotFoundHeader",
            message: "contragents.accountNotFoundMessage",
          },
        },
        { status: 400 },
      );
    }

    // Verify the contragent belongs to an organization owned by the user's account
    const contragent = await prisma.contragent.findFirst({
      where: {
        id: contragentId,
        organization: {
          account: {
            members: {
              some: {
                userId: userData.id,
              },
            },
          },
        },
      },
    });

    if (!contragent) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "contragents.contragentNotFoundHeader",
            message: "contragents.contragentNotFoundMessage",
          },
        },
        { status: 404 },
      );
    }

    const deletedContragent = await prisma.contragent.delete({
      where: {
        id: contragentId,
      },
    });

    return NextResponse.json(
      {
        data: deletedContragent,
        alert: {
          status: "success",
          header: "contragents.deleteSuccessHeader",
          message: "contragents.deleteSuccessMessage",
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Error deleting contragent:", err);

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
