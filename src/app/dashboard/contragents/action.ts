import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";
import { notFound } from "next/navigation";
import type { ContragentLight } from "../../../../utility/types";

export async function getContragents(): Promise<{
  data: ContragentLight[];
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
      },
    });

    if (!organizations || organizations.length === 0) {
      return { data: [], hasAccount: true };
    }

    const contragents = await prisma.contragent.findMany({
      where: {
        organizationId: {
          in: organizations.map((org) => org.id),
        },
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        bulstat: true,
        vatNumber: true,
        molName: true,
        email: true,
        address: true,
        organization: {
          select: {
            legalName: true,
          },
        },
      },
    });

    const contragentsLight: ContragentLight[] = contragents.map((c) => ({
      id: c.id,
      name: c.name,
      bulstat: c.bulstat,
      vatNumber: c.vatNumber,
      molName: c.molName,
      email: c.email,
      organizationId: c.organizationId,
      organizationName: c.organization.legalName,
      address: c.address as ContragentLight["address"],
    }));

    return { data: contragentsLight, hasAccount: true };
  } catch (err) {
    console.error("Error fetching contragents:", err);
    return { data: [], hasAccount: true };
  }
}

export async function getOrganizationsForContragents(): Promise<
  {
    id: number;
    legalName: string;
  }[]
> {
  const user = await getUserServer();
  if (!user) {
    return [];
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
      return [];
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
      },
      orderBy: {
        legalName: "asc",
      },
    });

    return organizations;
  } catch (err) {
    console.error("Error fetching organizations for contragents:", err);
    return [];
  }
}
