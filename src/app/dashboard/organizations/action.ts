import { prisma } from "../../../../utility/prisma";
import { NextResponse } from "next/server";
import { getUserServer } from "../../../../utility/get-user-server";
import { notFound } from "next/navigation";
import type { OrganizationLight } from "../../../../utility/types";

export async function getOrganizations(): Promise<{
  data: OrganizationLight[];
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
      },
    });

    if (!userData) {
      return notFound();
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
      },
    });

    if (!organizations) {
      return { data: [] };
    }

    return { data: organizations };
  } catch (err) {
    console.error("Error fetching organizations:", err);
    return { data: [] };
  }
}
