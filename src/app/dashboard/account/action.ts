import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";

export type AccountData = {
  id: number;
  name: string;
  creditBalance: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAccountData(): Promise<AccountData | null> {
  try {
    const userClaims = await getUserServer();

    if (!userClaims?.sub) {
      return null;
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { auth_uid: userClaims.sub },
    });

    if (!user) {
      return null;
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
            composer_name: true,
          },
        },
      },
    });

    if (!accountMember) {
      return null;
    }

    return accountMember.account;
  } catch (error) {
    console.error("Error fetching account data:", error);
    return null;
  }
}
