import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";
import { notFound } from "next/navigation";

export async function getUserAccountData() {
  const user = await getUserServer();
  if (!user) {
    notFound();
  }

  try {
    const userData = await prisma.user.findUnique({
      where: {
        auth_uid: user.sub,
      },
      select: {
        id: true,
      },
    });

    if (!userData) {
      return notFound();
    }

    const userAccount = await prisma.user.findUnique({
      where: {
        auth_uid: user.sub,
      },
      select: {
        accountMembers: {
          where: {
            userId: userData.id,
          },
          select: {
            accountId: true,
            account: {
              select: {
                composer_name: true,
                creditBalance: true,
                organizations: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    name: true,
                    bulstat: true,
                    vatNumber: true,
                    molName: true,
                    address: true,
                    bank: true,
                    iban: true,
                    bic: true,
                    invoiceSeriesPrefix: true,
                    current_inv_number: true,
                    contragents: {
                      orderBy: { createdAt: "asc" },
                      select: {
                        id: true,
                        name: true,
                        bulstat: true,
                        vatNumber: true,
                        molName: true,
                        address: true,
                        organizationId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userAccount) {
      return null;
    }

    // Serialize Prisma Decimal fields to plain strings for client compatibility
    return {
      ...userAccount,
      accountMembers: userAccount.accountMembers.map((member) => ({
        ...member,
        account: {
          ...member.account,
          organizations: member.account.organizations.map((org) => ({
            ...org,
            current_inv_number: org.current_inv_number
              ? org.current_inv_number.toString()
              : null,
          })),
        },
      })),
    };
  } catch (error) {
    console.error("Error fetching user account data:", error);
    return null;
  }
}
