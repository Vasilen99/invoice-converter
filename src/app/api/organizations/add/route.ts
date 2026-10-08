import { prisma } from "@/utility/prisma";
import { NextRequest } from "next/server";
import {
  enrichOrganizationDataFromRegistry,
  formatAddressForStorage,
  formatRawLookupDataForStorage,
  isValidCompanyData,
} from "@/utility/company-registry-helpers";
import {
  apiResponse,
  resolveAuthenticatedAccountContext,
} from "@/utility/helpers/server-api";

export async function POST(request: NextRequest) {
  try {
    const accountContext = await resolveAuthenticatedAccountContext();
    if (!accountContext) {
      return apiResponse(null, 401, {
        status: "error",
        header: "errorMessagesCommon.unauthorizedErrorHeader",
        message: "errorMessagesCommon.unauthorizedErrorMessage",
      });
    }

    const body = await request.json();
    let {
      bulstat,
      name,
      vatNumber,
      address,
      molName,
      email,
      bank,
      iban,
      bic,
      rawLookupData,
      isManualEntry = false,
    } = body;

    if (!bulstat || !name) {
      return apiResponse(null, 400, {
        status: "error",
        header: "organizations.missingFieldsHeader",
        message: "organizations.missingRequiredFieldsMessage",
      });
    }

    bulstat = bulstat.trim();
    name = name.trim();
    bank = bank ? bank.trim() : null;
    iban = iban ? iban.trim() : null;
    bic = bic ? bic.trim() : null;
    if (vatNumber) vatNumber = vatNumber.trim();
    if (molName) molName = molName.trim();
    if (email) email = email.trim();

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

    const formattedAddress = formatAddressForStorage(address);

    const account = await prisma.account.findUnique({
      where: {
        id: accountContext.accountId,
      },
      select: {
        organizations: {
          select: {
            bulstat: true,
          },
        },
      },
    });

    if (!account) {
      return apiResponse(null, 400, {
        status: "error",
        header: "organizations.accountNotFoundHeader",
        message: "organizations.accountNotFoundMessage",
      });
    }

    if (account.organizations.some((org) => org.bulstat === bulstat)) {
      return apiResponse(null, 200, {
        status: "info",
        header: "organizations.alreadyAddedHeader",
        message: "organizations.alreadyAddedMessage",
      });
    }

    let registryId: number | null = null;

    if (rawLookupData && isValidCompanyData(rawLookupData) && bulstat) {
      try {
        const formattedRawLookupData =
          formatRawLookupDataForStorage(rawLookupData);

        const existingRegistry = await prisma.companyRegistryCache.findUnique({
          where: { bulstat },
        });

        if (!existingRegistry) {
          const registryData: Record<string, unknown> = {
            bulstat,
            name,
            vatNumber: vatNumber || null,
            lastFetchedAt: new Date(),
            createdAt: new Date(),
          };

          if (formattedAddress) {
            registryData.address = formattedAddress;
          }

          if (
            formattedRawLookupData !== null &&
            formattedRawLookupData !== undefined
          ) {
            registryData.rawLookupData = formattedRawLookupData;
          }

          const registry = await prisma.companyRegistryCache.create({
            data: registryData as Parameters<
              typeof prisma.companyRegistryCache.create
            >[0]["data"],
          });
          registryId = registry.id;
        } else {
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
      }
    } else if (isManualEntry && bulstat) {
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
      }
    }

    const newOrganization = await prisma.organization.create({
      data: {
        bulstat,
        name,
        vatNumber: vatNumber || null,
        address: formattedAddress,
        molName: molName || null,
        bank: bank || null,
        iban: iban || null,
        bic: bic || null,
        email: email || null,
        invoiceSeriesPrefix: "INV",
        accountId: accountContext.accountId,
        source: isManualEntry ? "MANUAL" : "NAP_API",
        registryId,
      },
    });

    return apiResponse(newOrganization, 200, {
      status: "success",
      header: "organizations.addSuccessHeader",
      message: "organizations.addSuccessMessage",
    });
  } catch (err) {
    console.error("Error adding organization:", err);
    return apiResponse(null, 500, {
      status: "error",
      header: "errorMessagesCommon.serverErrorHeader",
      message: "errorMessagesCommon.serverErrorMessage",
    });
  }
}
