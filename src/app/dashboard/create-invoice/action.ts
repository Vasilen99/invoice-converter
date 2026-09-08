import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";
import { notFound } from "next/navigation";

export const getAccountData = async () => {
  const user = await getUserServer();
  if (!user) {
    return notFound();
  }

  try {
    const account = await prisma.account.findFirst({
      where: {
        members: {
          some: {
            user: {
              auth_uid: user.sub,
            },
          },
        },
      },
      select: {
        id: true,
        organizations: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!account?.id) {
      return null;
    }

    return account;
  } catch (err) {
    console.error("Error fetching account data:", err);
    return null;
  }
};
