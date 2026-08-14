import { NextResponse } from "next/server";
import { prisma } from "../../../../../../utility/prisma";
import { getUserServer } from "../../../../../../utility/get-user-server";

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

  return NextResponse.json(
    { data: { ...userData } },
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}
