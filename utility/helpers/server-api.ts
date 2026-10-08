import { NextResponse } from "next/server";
import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";
import type { ApiAlert, ApiResponse } from "@/utility/types/api";

export type AuthenticatedAccountContext = {
  userSub: string;
  accountId: number;
};

export async function resolveAuthenticatedAccountContext(): Promise<AuthenticatedAccountContext | null> {
  const user = await getUserServer();
  if (!user?.sub) {
    return null;
  }

  const accountMember = await prisma.accountMember.findFirst({
    where: {
      user: {
        auth_uid: user.sub,
      },
    },
    select: {
      accountId: true,
    },
  });

  if (!accountMember) {
    return null;
  }

  return {
    userSub: user.sub,
    accountId: accountMember.accountId,
  };
}

export function apiResponse<T>(
  data: T,
  status: number,
  alert: ApiAlert | null = null,
): NextResponse<ApiResponse<T>> {
  if (arguments.length === 0) {
    return null as never;
  }

  const payload: ApiResponse<T> = {
    data,
    alert,
  };

  return NextResponse.json(payload, { status });
}
