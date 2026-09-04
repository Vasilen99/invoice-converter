import { prisma } from "../../../../../utility/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";
import {
  formatAddressForStorage,
  isValidCompanyData,
  formatRawLookupDataForStorage,
  enrichOrganizationDataFromRegistry,
} from "../../../../../utility/company-registry-helpers";
import { notFound } from "next/navigation";

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
      name,
      vatNumber,
      address,
      molName,
      email,
      invoiceSeriesPrefix,
      bank,
      iban,
      bic,
      rawLookupData,
    } = body;

    // Validate required fields
    if (!organizationId || !bulstat || !name) {
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
    name = name.trim();
    bank = bank ? bank.trim() : null;
    iban = iban ? iban.trim() : null;
    bic = bic ? bic.trim() : null;
    if (vatNumber) vatNumber = vatNumber.trim();
    if (molName) molName = molName.trim();
    if (email) email = email.trim();
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
      return notFound();
    }

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

    let registryId = organization.registryId;

    // Only create new registry cache if organization doesn't already have one
    if (bulstat && !organization.registryId) {
      try {
        // Check if registry cache already exists for this bulstat
        const existingRegistry = await prisma.companyRegistryCache.findUnique({
          where: { bulstat },
        });

        if (!existingRegistry) {
          const registry = await prisma.companyRegistryCache.create({
            data: {
              bulstat,
              name: name,
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

    // Update the organization
    const updatedOrganization = await prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        bulstat,
        name: name,
        vatNumber: vatNumber || null,
        address: formattedAddress,
        molName: molName || null,
        bank: bank || null,
        iban: iban || null,
        bic: bic || null,
        email: email || null,
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
