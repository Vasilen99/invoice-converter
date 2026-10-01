import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";
import { notFound } from "next/navigation";
import { CREDIT_PRICING_CURRENCY } from "@/utility/credit-pricing";

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
      return {
        accountData: null,
        packageData: null,
      };
    }

    const accountData = await prisma.account.findFirst({
      where: { members: { some: { userId: userData.id } } },
      select: {
        id: true,
        creditBalance: true,
      },
    });

    const packageData = await prisma.creditPackage.findFirst({
      where: {
        isActive: true,
        currency: {
          equals: CREDIT_PRICING_CURRENCY,
        },
      },
      select: {
        id: true,
        name: true,
        priceAmount: true,
        currency: true,
      },
    });

    const transformedPackageData = packageData
      ? {
          id: packageData.id,
          name: packageData.name,
          priceAmount: packageData.priceAmount.toString(),
          currency: packageData.currency,
        }
      : null;
    return { accountData, packageData: transformedPackageData };
  } catch (err) {
    console.error("Error fetching account data for credits page:", err);
    return {
      accountData: null,
      packageData: null,
    };
  }
}
