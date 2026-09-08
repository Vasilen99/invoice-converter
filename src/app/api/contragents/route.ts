import { prisma } from "../../../../utility/prisma";
import { NextResponse, NextRequest } from "next/server";
import { getUserServer } from "../../../../utility/get-user-server";
import { notFound } from "next/navigation";
export async function GET(req: NextRequest) {
  const user = await getUserServer();
  if (!user) {
    return notFound();
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const organizationId = searchParams.get("organizationId");
    const accId = searchParams.get("accountId");

    if (!organizationId || !accId) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "createInvoice.errors.missingOrganizationId",
            message: "createInvoice.errors.missingOrganizationIdDescription",
          },
        },
        { status: 400 },
      );
    }

    const userContragents = await prisma.contragent.findMany({
      where: {
        organization: {
          id: Number(organizationId),
          accountId: Number(accId),
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({
      data: userContragents,
      status: 200,
    });
  } catch (er) {
    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "createInvoice.errors.serverErrorHeaderFetchContragents",
          message:
            "createInvoice.errors.serverErrorDescriptionFetchContragents",
        },
      },
      { status: 500 },
    );
  }
}
