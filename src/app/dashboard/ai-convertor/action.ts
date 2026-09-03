import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";

export async function getAccountData() {
  try {
    const userClaims = await getUserServer();

    if (!userClaims?.sub) {
      return null;
    }

    const accountMember = await prisma.accountMember.findFirst({
      where: {
        user: {
          auth_uid: userClaims.sub,
        },
      },
      select: {
        account: {
          select: {
            id: true,
            creditBalance: true,
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
