import { NextResponse } from "next/server";
import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";

export async function GET() {
  const userClaims = await getUserServer();

  if (!userClaims?.sub) {
    return NextResponse.json(
      { data: null },
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }
  const userData = await prisma.user.findUnique({
    where: { auth_uid: userClaims.sub },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      image: true,
      accountMembers: {
        where: { user: { auth_uid: userClaims.sub } },
        select: {
          account: {
            select: {
              name: true,
              creditBalance: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!userData) {
    return NextResponse.json(
      { data: null },
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const accountName = userData.accountMembers[0]?.account?.name || null;
  const creditBalance = userData.accountMembers[0]?.account?.creditBalance ?? 0;
  const { ...userDataWithoutMembers } = userData;

  return NextResponse.json(
    {
      data: {
        ...userDataWithoutMembers,
        accountName,
        creditBalance,
      },
    },
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}
