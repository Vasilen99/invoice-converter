import { prisma } from "../../../../../utility/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";
import { notFound } from "next/navigation";
export async function POST(request: NextRequest) {
  const user = await getUserServer();
  if (!user) {
    return notFound();
  }

  try {
    const body = await request.json();
    const {
      legalName,
      bulstat,
      vatNumber,
      address,
      molName,
      invoiceSeriesPrefix,
      rawLookupData,
    } = body;

    const userAccount = await prisma.accountMember.findFirst({
      where: {
        user: {
          auth_uid: user.sub,
        },
      },
      select: {
        accountId: true,
        account: {
          select: {
            organizations: {
              select: {
                bulstat: true,
              },
            },
          },
        },
      },
    });

    if (!userAccount) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "Account not found",
            message: "User does not belong to any account",
          },
        },
        { status: 400 },
      );
    }

    if (
      userAccount.account.organizations.some((org) => org.bulstat === bulstat)
    ) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "info",
            header: "Organization already exists",
            message:
              "An organization with the same BULSTAT already exists in your account",
          },
        },
        { status: 200 },
      );
    }

    let registryId: number | null = null;

    // If we have rawLookupData from the API, store it in CompanyRegistryCache
    if (rawLookupData && bulstat) {
      try {
        const registry = await prisma.companyRegistryCache.upsert({
          where: { bulstat },
          update: {
            legalName,
            vatNumber,
            address,
            rawLookupData,
            lastFetchedAt: new Date(),
          },
          create: {
            bulstat,
            legalName,
            vatNumber,
            address,
            rawLookupData,
          },
        });
        registryId = registry.id;
      } catch (registryErr) {
        console.error("Error creating registry cache:", registryErr);
      }
    }

    const newOrganization = await prisma.organization.create({
      data: {
        legalName,
        bulstat,
        vatNumber,
        address,
        molName,
        invoiceSeriesPrefix,
        accountId: userAccount.accountId,
        source: rawLookupData ? "NAP_API" : "MANUAL",
        registryId,
        createdAt: new Date(),
      },
    });
    return NextResponse.json({ data: newOrganization });
  } catch (err) {
    console.error("Error adding organization:", err);
    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "Error adding organization",
          message: "An error occurred while adding the organization",
        },
      },
      { status: 500 },
    );
  }
}
