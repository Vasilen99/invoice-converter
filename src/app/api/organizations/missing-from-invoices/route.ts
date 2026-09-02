import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../utility/prisma";
import { getUserServer } from "../../../../../utility/get-user-server";
import {
  extractVatNumber,
  transformAddressFromCompanyData,
} from "../../../../../utility/company-registry-helpers";

type MissingOrgFromCache = {
  bulstat: string;
  name: string;
  vatNumber: string | null;
  address: unknown;
  rawLookupData: unknown;
};

type InvoicePairInput = {
  sellerEik?: string;
  buyerEik?: string;
};

type MissingContragentFromCache = MissingOrgFromCache & {
  organizationId: number | null;
  organizationBulstat: string;
  organizationName: string | null;
};

function normalizeBulstat(value: string | undefined | null): string {
  return (value ?? "").trim();
}

/**
 * Fetches company data from CompanyBook external API
 */
async function fetchFromExternalApi(
  bulstat: string,
): Promise<MissingOrgFromCache | null> {
  const apiKey = process.env.COMPANY_BOOK_API_KEY;
  if (!apiKey) {
    console.warn("[Missing Orgs] COMPANY_BOOK_API_KEY not configured");
    return null;
  }

  try {
    const url = `https://api.companybook.bg/api/companies/${bulstat}?with_data=true`;
    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Company not found in external API
      }
      console.error(
        `CompanyBook API error ${response.status} for bulstat ${bulstat}`,
      );
      return null;
    }

    const data = await response.json();
    const company = data.company || data;

    // Transform external API response to our format
    const vatNumber = extractVatNumber(company);
    const address = transformAddressFromCompanyData(company);
    const name =
      company.companyName?.name ||
      company.companyNameTransliteration?.name ||
      "";

    if (!name) {
      return null; // Invalid company data
    }

    return {
      bulstat: company.uic || bulstat,
      name,
      vatNumber,
      address,
      rawLookupData: company,
    };
  } catch (error) {
    console.error(
      `[Missing Orgs] Error fetching from external API for bulstat ${bulstat}:`,
      error,
    );
    return null;
  }
}

async function getCompaniesFromCacheOrExternal(bulstats: string[]): Promise<{
  companies: MissingOrgFromCache[];
  notFoundBulstats: string[];
}> {
  if (bulstats.length === 0) {
    return {
      companies: [],
      notFoundBulstats: [],
    };
  }

  const cacheEntries = await prisma.companyRegistryCache.findMany({
    where: {
      bulstat: {
        in: bulstats,
      },
    },
    select: {
      bulstat: true,
      name: true,
      vatNumber: true,
      address: true,
      rawLookupData: true,
    },
  });

  const cacheCompanies: MissingOrgFromCache[] = cacheEntries.map((entry) => ({
    bulstat: entry.bulstat,
    name: entry.name,
    vatNumber: entry.vatNumber,
    address: entry.address,
    rawLookupData: entry.rawLookupData,
  }));

  const foundInCacheBulstats = new Set(
    cacheCompanies.map((org) => org.bulstat),
  );

  const notFoundInCacheBulstats = bulstats.filter(
    (bulstat) => !foundInCacheBulstats.has(bulstat),
  );

  const externalApiResults: MissingOrgFromCache[] = [];
  for (const bulstat of notFoundInCacheBulstats) {
    const externalResult = await fetchFromExternalApi(bulstat);
    if (externalResult) {
      externalApiResults.push(externalResult);
    }
  }

  const notFoundBulstats = notFoundInCacheBulstats.filter(
    (bulstat) => !externalApiResults.some((org) => org.bulstat === bulstat),
  );

  return {
    companies: [...cacheCompanies, ...externalApiResults],
    notFoundBulstats,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserServer();

    if (!user?.sub) {
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

    const body = await request.json();
    const eiksInput: unknown[] = Array.isArray(body?.eiks) ? body.eiks : [];

    const invoicePairsInput: InvoicePairInput[] = Array.isArray(
      body?.invoicePairs,
    )
      ? body.invoicePairs
      : [];

    const normalizedEiks: string[] = [
      ...new Set<string>(
        eiksInput.reduce<string[]>((acc, value) => {
          if (typeof value !== "string") {
            return acc;
          }

          const normalized = normalizeBulstat(value);
          if (!normalized) {
            return acc;
          }

          acc.push(normalized);
          return acc;
        }, []),
      ),
    ];

    const normalizedInvoicePairs = Array.from(
      new Map(
        invoicePairsInput
          .map((pair) => {
            const sellerEik = normalizeBulstat(pair?.sellerEik);
            const buyerEik = normalizeBulstat(pair?.buyerEik);
            return { sellerEik, buyerEik };
          })
          .filter((pair) => pair.buyerEik.length > 0)
          .map((pair) => [`${pair.sellerEik}::${pair.buyerEik}`, pair]),
      ).values(),
    );

    const allOrganizationEiks = [
      ...new Set([
        ...normalizedEiks,
        ...normalizedInvoicePairs
          .map((pair) => pair.sellerEik)
          .filter((value) => value.length > 0),
      ]),
    ];

    if (
      allOrganizationEiks.length === 0 &&
      normalizedInvoicePairs.length === 0
    ) {
      return NextResponse.json({
        data: {
          missingOrganizations: [],
          missingContragents: [],
          notFoundBulstats: [],
          notFoundContragentBulstats: [],
        },
      });
    }

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
                id: true,
                name: true,
                bulstat: true,
                contragents: {
                  select: {
                    bulstat: true,
                  },
                },
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

    const existingBulstats = new Set<string>(
      userAccount.account.organizations
        .map((org: { bulstat: string | null }) =>
          normalizeBulstat(org.bulstat ?? ""),
        )
        .filter((value: string) => value.length > 0),
    );

    const missingBulstats: string[] = allOrganizationEiks.filter(
      (bulstat) => !existingBulstats.has(bulstat),
    );

    const organizationByBulstat = new Map<
      string,
      {
        id: number;
        name: string;
        contragentBulstats: Set<string>;
      }
    >();

    for (const org of userAccount.account.organizations) {
      const bulstat = normalizeBulstat(org.bulstat);
      if (!bulstat) {
        continue;
      }

      organizationByBulstat.set(bulstat, {
        id: org.id,
        name: org.name,
        contragentBulstats: new Set(
          org.contragents
            .map((contragent) => normalizeBulstat(contragent.bulstat))
            .filter(Boolean),
        ),
      });
    }

    const { companies: validMissingOrganizations, notFoundBulstats } =
      await getCompaniesFromCacheOrExternal(missingBulstats);

    const contragentCandidates = new Map<
      string,
      {
        organizationId: number | null;
        organizationBulstat: string;
        organizationName: string | null;
        bulstat: string;
      }
    >();

    // Track seller EIKs that are missing (not in user account)
    const missingSellerEiksThatNeedCreation = new Set<string>();

    for (const pair of normalizedInvoicePairs) {
      const organizationBulstat = pair.sellerEik;
      const contragentBulstat = pair.buyerEik;

      if (!contragentBulstat) {
        continue;
      }

      const organization = organizationByBulstat.get(organizationBulstat);

      if (organization?.contragentBulstats.has(contragentBulstat)) {
        continue;
      }

      const key = `${organizationBulstat}::${contragentBulstat}`;

      // If seller org doesn't exist in user's account
      if (!organization) {
        missingSellerEiksThatNeedCreation.add(organizationBulstat);
      }

      contragentCandidates.set(key, {
        organizationId: organization?.id ?? null,
        organizationBulstat,
        organizationName: organization?.name ?? null,
        bulstat: contragentBulstat,
      });
    }

    // If there are seller organizations missing for contragents, fetch and add them
    if (missingSellerEiksThatNeedCreation.size > 0) {
      const additionalMissingSellerEiks = Array.from(
        missingSellerEiksThatNeedCreation,
      ).filter(
        (bulstat) =>
          !validMissingOrganizations.some((org) => org.bulstat === bulstat),
      );

      if (additionalMissingSellerEiks.length > 0) {
        const {
          companies: additionalOrganizations,
          notFoundBulstats: additionalNotFound,
        } = await getCompaniesFromCacheOrExternal(
          additionalMissingSellerEiks as string[],
        );

        validMissingOrganizations.push(...additionalOrganizations);
        notFoundBulstats.push(...additionalNotFound);
      }
    }

    const missingContragentBulstats = [
      ...new Set(
        Array.from(contragentCandidates.values()).map((item) => item.bulstat),
      ),
    ];

    const {
      companies: contragentLookupResults,
      notFoundBulstats: notFoundContragentBulstats,
    } = await getCompaniesFromCacheOrExternal(missingContragentBulstats);

    const contragentLookupByBulstat = new Map(
      contragentLookupResults.map((company) => [company.bulstat, company]),
    );

    const missingContragents: MissingContragentFromCache[] = Array.from(
      contragentCandidates.values(),
    )
      .map((candidate) => {
        const companyData = contragentLookupByBulstat.get(candidate.bulstat);
        if (!companyData) {
          return null;
        }

        return {
          ...companyData,
          organizationId: candidate.organizationId,
          organizationBulstat: candidate.organizationBulstat,
          organizationName: candidate.organizationName,
        };
      })
      .filter(
        (candidate): candidate is MissingContragentFromCache =>
          candidate !== null,
      );

    return NextResponse.json({
      data: {
        missingOrganizations: validMissingOrganizations,
        missingContragents,
        notFoundBulstats,
        notFoundContragentBulstats,
      },
    });
  } catch (error) {
    console.error(
      "[Missing Organizations] Error checking organizations:",
      error,
    );
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
