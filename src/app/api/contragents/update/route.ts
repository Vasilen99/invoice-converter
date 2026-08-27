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
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "contragents.contragentNotFoundHeader",
            message: "contragents.contragentNotFoundMessage",
          },
        },
        { status: 404 },
      );
    }

    // Enrich data from rawLookupData if available
    if (rawLookupData && isValidCompanyData(rawLookupData) && bulstat) {
      const enrichedData = enrichOrganizationDataFromRegistry(
        {
          bulstat,
          legalName: name,
          vatNumber,
          address,
          molName,
        },
        rawLookupData,
      );

      bulstat = enrichedData.bulstat;
      name = enrichedData.legalName;
      vatNumber = enrichedData.vatNumber || null;
      address = enrichedData.address;
      molName = enrichedData.molName;
    }

    // Format address for storage
    const formattedAddress = formatAddressForStorage(address);

    let registryId = contragent.registryId;

    // Update registry cache if we have bulstat
    if (bulstat) {
      let registry;

      // If we have an existing registryId, update that record directly
      if (contragent.registryId) {
        registry = await prisma.companyRegistryCache.update({
          where: { id: contragent.registryId },
          data: {
            bulstat,
            legalName: name,
            vatNumber: vatNumber || null,
            address: formattedAddress,
            lastFetchedAt: new Date(),
          },
        });
      } else {
        // Only create new if no existing registry
        registry = await prisma.companyRegistryCache.create({
          data: {
            bulstat,
            legalName: name,
            vatNumber: vatNumber || null,
            address: formattedAddress,
          },
        });
      }
      registryId = registry.id;
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
