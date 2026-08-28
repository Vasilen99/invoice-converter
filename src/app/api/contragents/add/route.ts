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
      organizationId,
      rawLookupData,
      isManualEntry = false,
    } = body;

    // Validate required fields
    if (!name || !organizationId) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "contragents.missingFieldsHeader",
            message: "contragents.missingRequiredFieldsMessage",
            details: {
              name: `"${name}" (empty: ${!name})`,
              organizationId: `${organizationId}`,
            },
          },
        },
        { status: 400 },
      );
    }

    // Sanitize inputs
    name = name.trim();
    if (bulstat) bulstat = bulstat.trim();
    if (vatNumber) vatNumber = vatNumber.trim();
    if (molName) molName = molName.trim();
    if (email) email = email.trim();

    // Enrich data from rawLookupData if available
    if (rawLookupData && isValidCompanyData(rawLookupData) && bulstat) {
      const enrichedData = enrichOrganizationDataFromRegistry(
        {
          bulstat,
          name: name,
          vatNumber,
          address,
          molName,
        },
        rawLookupData,
      );

      bulstat = enrichedData.bulstat;
      name = enrichedData.name;
      vatNumber = enrichedData.vatNumber || null;
      address = enrichedData.address;
      molName = enrichedData.molName;
    }

    // Format address for storage
    const formattedAddress = formatAddressForStorage(address);

    // Verify the organization belongs to the user's account
    const userData = await prisma.user.findUnique({
      where: {
        auth_uid: user.sub,
      },
      select: {
        id: true,
      },
    });

    if (!userData) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "contragents.accountNotFoundHeader",
            message: "contragents.accountNotFoundMessage",
          },
        },
        { status: 400 },
      );
    }

    // Check if organization exists and belongs to user's account
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        account: {
          members: {
            some: {
              userId: userData.id,
            },
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "organizations.organizationNotFoundHeader",
            message: "organizations.organizationNotFoundMessage",
          },
        },
        { status: 400 },
      );
    }

    // Check if contragent already exists for this organization
    if (bulstat) {
      const existingContragent = await prisma.contragent.findFirst({
        where: {
          organizationId,
          bulstat,
        },
      });

      if (existingContragent) {
        return NextResponse.json(
          {
            data: null,
            alert: {
              status: "info",
              header: "contragents.alreadyAddedHeader",
              message: "contragents.alreadyAddedMessage",
            },
          },
          { status: 200 },
        );
      }
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

    // Create the contragent
    const newContragent = await prisma.contragent.create({
      data: {
        bulstat: bulstat || null,
        name,
        vatNumber: vatNumber || null,
        address: formattedAddress,
        molName: molName || null,
        email: email || null,
        organizationId,
        source: isManualEntry ? "MANUAL" : "NAP_API",
        registryId,
      },
    });

    return NextResponse.json({
      id: newContragent.id,
      data: newContragent,
      alert: {
        status: "success",
        header: "contragents.addSuccessHeader",
        message: "contragents.addSuccessMessage",
      },
    });
  } catch (err) {
    console.error("Error adding contragent:", err);
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
