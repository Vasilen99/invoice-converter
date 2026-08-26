import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";
import { notFound } from "next/navigation";
import type { OrganizationLight } from "../../../../utility/types";

export async function getOrganizations(): Promise<{
  data: OrganizationLight[];
  hasAccount?: boolean;
}> {
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
        id: true,
        accountMembers: {
          where: {
            user: {
              auth_uid: user.sub,
            },
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!userData) {
      return notFound();
    }

    if (!userData.accountMembers || !userData.accountMembers.length) {
      return { data: [], hasAccount: false };
    }

    const organizations = await prisma.organization.findMany({
      where: {
        account: {
          members: {
            some: {
              userId: userData.id,
            },
          },
        },
      },
      select: {
        id: true,
        legalName: true,
        bulstat: true,
        vatNumber: true,
        molName: true,
        invoiceSeriesPrefix: true,
        address: true,
      },
    });

    if (!organizations) {
      return { data: [] };
    }

    // Map and cast the address field properly
    const formattedOrganizations: OrganizationLight[] = organizations.map(
      (org) => ({
        ...org,
        address: org.address as OrganizationLight["address"],
      }),
    );

    return { data: formattedOrganizations, hasAccount: true };
  } catch (err) {
    console.error("Error fetching organizations:", err);
    return { data: [] };
  }
}
