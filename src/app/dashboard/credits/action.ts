import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";
import { notFound } from "next/navigation";

export async function getAccountData() {
  const user = await getUserServer();
  if (!user) {
    return notFound();
  }

  try {
    const userData = await prisma.user.findUnique({
      where: { auth_uid: user.sub },
      select: {
        id: true,
      },
    });

    if (!userData) {
      return null;
    }

    const accountData = await prisma.account.findFirst({
      where: { members: { some: { userId: userData.id } } },
      select: {
        id: true,
        creditBalance: true,
      },
    });

    if (!accountData) {
      return null;
    }

    return accountData;
  } catch (err) {
    console.error("Error fetching account data for credits page:", err);
    return null;
  }
}
