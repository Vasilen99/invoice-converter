import { prisma } from "../../../../../utility/prisma";
import { NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";

export async function GET() {
  try {
    const userClaims = await getUserServer();

    if (!userClaims?.sub) {
      return NextResponse.json(
        { data: null },
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { auth_uid: userClaims.sub },
    });

    if (!user) {
      return NextResponse.json(
        { data: null },
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    // Get user's account (first account they're a member of)
    const accountMember = await prisma.accountMember.findFirst({
      where: { userId: user.id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            creditBalance: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!accountMember) {
      return NextResponse.json(
        { data: null },
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return NextResponse.json(
      { data: accountMember.account },
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    console.error("Error fetching account data:", error);
    return NextResponse.json(
      { error: "Failed to fetch account data" },
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
