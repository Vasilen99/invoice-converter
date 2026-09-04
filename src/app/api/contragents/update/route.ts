import { prisma } from "../../../../../utility/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";
import {
  formatAddressForStorage,
  isValidCompanyData,
  enrichOrganizationDataFromRegistry,
} from "../../../../../utility/company-registry-helpers";
import { notFound } from "next/navigation";

export async function PUT(request: NextRequest) {
  const user = await getUserServer();
  if (!user) {
    return notFound();
  }

  try {
    const body = await request.json();
    let {
      contragentId,
      bulstat,
      name,
      vatNumber,
      address,
      molName,
      email,
      organizationId,
      rawLookupData,
    } = body;

    // Validate required fields
    if (!contragentId || !name || !organizationId) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "contragents.missingFieldsHeader",
            message: "contragents.missingFieldsMessage",
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

    // Get user data
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

    // Verify contragent belongs to an organization owned by user's account
    const contragent = await prisma.contragent.findFirst({
      where: {
        id: contragentId,
        organization: {
          account: {
            members: {
              some: {
                userId: userData.id,
              },
            },
          },
        },
      },
    });

    if (!contragent) {
      return notFound();
    }

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

    let registryId = contragent.registryId;

    // Only create new registry cache if contragent doesn't already have one
    if (bulstat && !contragent.registryId) {
      try {
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
    }

    // Update the contragent
    const updatedContragent = await prisma.contragent.update({
      where: {
        id: contragentId,
      },
      data: {
        bulstat: bulstat || null,
        name,
        vatNumber: vatNumber || null,
        address: formattedAddress,
        molName: molName || null,
        email: email || null,
        organizationId,
        registryId,
      },
    });

    return NextResponse.json({
      id: updatedContragent.id,
      data: updatedContragent,
      alert: {
        status: "success",
        header: "contragents.updateSuccessHeader",
        message: "contragents.updateSuccessMessage",
      },
    });
  } catch (err) {
    console.error("Error updating contragent:", err);
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
