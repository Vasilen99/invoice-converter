import { prisma } from "../../../../../utility/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";
import {
  formatAddressForStorage,
  isValidCompanyData,
  formatRawLookupDataForStorage,
  enrichOrganizationDataFromRegistry,
} from "../../../../../utility/company-registry-helpers";

export async function PUT(request: NextRequest) {
  const user = await getUserServer();
  if (!user) {
    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "errorMessagesCommon.unauthorizedErrorHeader",
          message: "errorMessagesCommon.unauthorizedErrorMessage",
        },
      },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    let {
      organizationId,
      bulstat,
      legalName,
      vatNumber,
      address,
      molName,
      invoiceSeriesPrefix,
      rawLookupData,
    } = body;

    // Validate required fields
    if (!organizationId || !bulstat || !legalName) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "organizations.missingFieldsHeader",
            message: "organizations.missingFieldsMessage",
          },
        },
        { status: 400 },
      );
    }

    // Sanitize inputs
    bulstat = bulstat.trim();
    legalName = legalName.trim();
    if (vatNumber) vatNumber = vatNumber.trim();
    if (molName) molName = molName.trim();
    if (invoiceSeriesPrefix) invoiceSeriesPrefix = invoiceSeriesPrefix.trim();

    // Check user has access to this organization
    const userAccount = await prisma.accountMember.findFirst({
      where: {
        user: {
          auth_uid: user.sub,
        },
      },
      select: {
        accountId: true,
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

    // Verify organization belongs to user's account
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        accountId: userAccount.accountId,
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
        { status: 404 },
      );
    }

    // Enrich data from rawLookupData if available
    if (rawLookupData && isValidCompanyData(rawLookupData)) {
      const enrichedData = enrichOrganizationDataFromRegistry(
        {
          bulstat,
          legalName,
          vatNumber,
          address,
          molName,
        },
        rawLookupData,
      );

      bulstat = enrichedData.bulstat;
      legalName = enrichedData.legalName;
      vatNumber = enrichedData.vatNumber || null;
      address = enrichedData.address;
      molName = enrichedData.molName;
    }

    // Format address for storage
    const formattedAddress = formatAddressForStorage(address);

    let registryId = organization.registryId;

    let registry;

    // If we have an existing registryId, update that record directly
    if (organization.registryId) {
      registry = await prisma.companyRegistryCache.update({
        where: { id: organization.registryId },
        data: {
          bulstat,
          legalName,
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
          legalName,
          vatNumber: vatNumber || null,
          address: formattedAddress,
        },
      });
    }
    registryId = registry.id;

    // Update the organization
    const updatedOrganization = await prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        bulstat,
        legalName,
        vatNumber: vatNumber || null,
        address: formattedAddress,
        molName: molName || null,
        invoiceSeriesPrefix: invoiceSeriesPrefix || "INV",
        registryId,
      },
    });

    return NextResponse.json({
      id: updatedOrganization.id,
      data: updatedOrganization,
      alert: {
        status: "success",
        header: "organizations.updateSuccessHeader",
        message: "organizations.updateSuccessMessage",
      },
    });
  } catch (err) {
    console.error("Error updating organization:", err);
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
