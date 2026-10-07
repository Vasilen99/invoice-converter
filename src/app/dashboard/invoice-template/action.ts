import { getUserServer } from "@/utility/get-user-server";
import { notFound } from "next/navigation";
import { prisma } from "@/utility/prisma";

export const getAccountDataTemplate = async () => {
  const user = await getUserServer();

  if (!user) {
    return notFound();
  }

  try {
    const userData = await prisma.user.findUnique({
      where: {
        auth_uid: user.sub,
      },
      select: {
        accountMembers: {
          select: {
            accountId: true,
          },
        },
      },
    });

    if (!userData) {
      return notFound();
    }

    const account = await prisma.account.findUnique({
      where: {
        id: userData.accountMembers[0].accountId,
      },
      select: {
        inv_template: true,
        id: true,
      },
    });

    if (!account) {
      return null;
    }

    return account;
  } catch (error) {
    console.error("Error fetching account data:", error);
    return null;
  }
};
