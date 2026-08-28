import { prisma } from "../../../../../utility/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";
import { notFound } from "next/navigation";
import {
  enrichOrganizationDataFromRegistry,
  formatAddressForStorage,
  formatRawLookupDataForStorage,
  isValidCompanyData,
} from "../../../../../utility/company-registry-helpers";
export async function POST(request: NextRequest) {
  const user = await getUserServer();
  if (!user) {
    return notFound();
  }

  try {
    const body = await request.json();
    let {
      bulstat,
      name,
      vatNumber,
      address,
      molName,
      email,
      rawLookupData,
      isManualEntry = false,
    } = body;

    // Validate required fields
    if (!bulstat || !name) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "organizations.missingFieldsHeader",
            message: "organizations.missingRequiredFieldsMessage",
          },
        },
        { status: 400 },
      );
    }

    // Sanitize inputs
    bulstat = bulstat.trim();
    name = name.trim();
    if (vatNumber) vatNumber = vatNumber.trim();
    if (molName) molName = molName.trim();
    if (email) email = email.trim();

    // Enrich data from rawLookupData if available
    if (rawLookupData && isValidCompanyData(rawLookupData)) {
      const enrichedData = enrichOrganizationDataFromRegistry(
        {
          bulstat,
          name,
          vatNumber,
          address,
          molName,
          email,
        },
        rawLookupData,
      );

      bulstat = enrichedData.bulstat;
      name = enrichedData.name;
      vatNumber = enrichedData.vatNumber || null;
      address = enrichedData.address;
      molName = enrichedData.molName;
      email = enrichedData.email || null;
    }

    // Format address for storage
    const formattedAddress = formatAddressForStorage(address);

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
            header: "organizations.accountNotFoundHeader",
            message: "organizations.accountNotFoundMessage",
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
            header: "organizations.alreadyAddedHeader",
            message: "organizations.alreadyAddedMessage",
          },
        },
        { status: 200 },
      );
    }

    let registryId: number | null = null;

    // Store raw lookup data in CompanyRegistryCache - only create new records
    if (rawLookupData && isValidCompanyData(rawLookupData) && bulstat) {
      try {
        const formattedRawLookupData =
          formatRawLookupDataForStorage(rawLookupData);

        // Check if registry cache already exists for this bulstat
        const existingRegistry = await prisma.companyRegistryCache.findUnique({
          where: { bulstat },
        });

        if (!existingRegistry) {
          const registry = await prisma.companyRegistryCache.create({
            data: {
              bulstat,
              name,
              vatNumber: vatNumber || null,
              address: formattedAddress,
              rawLookupData: formattedRawLookupData,
              lastFetchedAt: new Date(),
              createdAt: new Date(),
            },
          });
          registryId = registry.id;
        } else {
          // Update lastFetchedAt when we find existing registry
          await prisma.companyRegistryCache.update({
            where: { bulstat },
            data: { lastFetchedAt: new Date() },
          });
          registryId = existingRegistry.id;
        }
      } catch (registryErr) {
        console.error(
          `[Registry Cache Error] Failed to create registry for BULSTAT ${bulstat}:`,
          registryErr,
        );
        // Continue even if registry cache fails - it's not critical
      }
    } else if (isManualEntry && bulstat) {
      // For manual entries, create registry cache only if it doesn't exist
      try {
        const existingRegistry = await prisma.companyRegistryCache.findUnique({
          where: { bulstat },
        });

        if (!existingRegistry) {
          const registry = await prisma.companyRegistryCache.create({
            data: {
              bulstat,
              name,
              vatNumber: vatNumber || null,
              address: formattedAddress,
              lastFetchedAt: new Date(),
              createdAt: new Date(),
            },
          });
          registryId = registry.id;
        } else {
          // Update lastFetchedAt when we find existing registry
          await prisma.companyRegistryCache.update({
            where: { bulstat },
            data: { lastFetchedAt: new Date() },
          });
          registryId = existingRegistry.id;
        }
      } catch (registryErr) {
        console.error(
          `[Registry Cache Error] Failed to create manual registry for BULSTAT ${bulstat}:`,
          registryErr,
        );
        // Continue even if registry cache fails - it's not critical
      }
    }

    // Create the organization
    const newOrganization = await prisma.organization.create({
      data: {
        bulstat,
        name: name,
        vatNumber: vatNumber || null,
        address: formattedAddress,
        molName: molName || null,
        email: email || null,
        invoiceSeriesPrefix: "INV",
        accountId: userAccount.accountId,
        source: isManualEntry ? "MANUAL" : "NAP_API",
        registryId,
      },
    });

    return NextResponse.json({
      id: newOrganization.id,
      data: newOrganization,
      alert: {
        status: "success",
        header: "organizations.addSuccessHeader",
        message: "organizations.addSuccessMessage",
      },
    });
  } catch (err) {
    console.error("Error adding organization:", err);
    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "errorMessagesCommon.serverErrorHeader",
          message: "errorMessagesCommon.serverErrorMessage",
        },
      },
      { status: 500 },
    );
  }
}
