import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../utility/prisma";
import { getUserServer } from "../../../../../utility/get-user-server";
import { notFound } from "next/navigation";

type MissingOrganizationByEik = {
  bulstat: string;
};

type InvoicePairInput = {
  sellerEik?: string;
  buyerEik?: string;
};

type MissingContragentRelationByEik = {
  bulstat: string;
  organizationId: number | null;
  organizationBulstat: string;
  organizationName: string | null;
};

function normalizeBulstat(value: string | undefined | null): string {
  return (value ?? "").trim();
}

async function getCachedBulstats(bulstats: string[]): Promise<Set<string>> {
  if (bulstats.length === 0) {
    return new Set();
  }

  const cacheEntries = await prisma.companyRegistryCache.findMany({
    where: {
      bulstat: {
        in: bulstats,
      },
    },
    select: { bulstat: true },
  });

  return new Set(cacheEntries.map((entry) => normalizeBulstat(entry.bulstat)));
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserServer();

    if (!user?.sub) {
      return notFound();
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
          .filter(
            (pair) => pair.sellerEik.length > 0 && pair.buyerEik.length > 0,
          )
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
          missingOrganizationBulstats: [],
          missingContragentBulstats: [],
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

    const cachedMissingOrganizationBulstats =
      await getCachedBulstats(missingBulstats);

    const missingOrganizationBulstats = missingBulstats.filter(
      (bulstat) => !cachedMissingOrganizationBulstats.has(bulstat),
    );

    const missingOrganizations: MissingOrganizationByEik[] =
      missingOrganizationBulstats.map((bulstat) => ({ bulstat }));

    const contragentCandidates = new Map<
      string,
      {
        organizationId: number | null;
        organizationBulstat: string;
        organizationName: string | null;
        bulstat: string;
      }
    >();

    for (const pair of normalizedInvoicePairs) {
      const organizationBulstat = pair.sellerEik;
      const contragentBulstat = pair.buyerEik;

      const organization = organizationByBulstat.get(organizationBulstat);

      if (organization?.contragentBulstats.has(contragentBulstat)) {
        continue;
      }

      const key = `${organizationBulstat}::${contragentBulstat}`;

      contragentCandidates.set(key, {
        organizationId: organization?.id ?? null,
        organizationBulstat,
        organizationName: organization?.name ?? null,
        bulstat: contragentBulstat,
      });
    }

    const contragentBulstats = [
      ...new Set(
        Array.from(contragentCandidates.values()).map((item) => item.bulstat),
      ),
    ];

    const cachedContragentBulstats =
      await getCachedBulstats(contragentBulstats);

    const missingContragents: MissingContragentRelationByEik[] = Array.from(
      contragentCandidates.values(),
    ).filter((candidate) => !cachedContragentBulstats.has(candidate.bulstat));

    const missingContragentBulstats = [
      ...new Set(missingContragents.map((item) => item.bulstat)),
    ];

    return NextResponse.json({
      data: {
        missingOrganizations,
        missingContragents,
        missingOrganizationBulstats,
        missingContragentBulstats,
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
