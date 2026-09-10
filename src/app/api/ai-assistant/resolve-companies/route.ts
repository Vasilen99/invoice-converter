import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../utility/prisma";
import { getUserServer } from "../../../../../utility/get-user-server";
import type { AddressData, CompanyData } from "../../../../../utility/types";
import {
  extractEmail,
  extractManagerName,
  extractVatNumber,
  transformAddressFromCompanyData,
} from "../../../../../utility/company-registry-helpers";
import { getCachedCompanyData } from "../../../../../utility/registry-cache";

type CompanyRole = "organization" | "contragent";

type CompanyResolutionSource = "DB" | "CACHE" | "EXTERNAL";

type ResolvedCompany = {
  name: string;
  bulstat: string;
  vatNumber: string | null;
  molName: string | null;
  email: string | null;
  address?: AddressData;
  source: CompanyResolutionSource;
  organizationId?: number;
  contragentId?: number;
};

type ResolveCompaniesBody = {
  organizationName?: string;
  contragentName?: string;
  organizationEik?: string;
  contragentEik?: string;
};

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeEik(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "").trim();
}

function addressFromUnknown(value: unknown): AddressData | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as AddressData;
}

function mapCompanyData(
  data: CompanyData,
  fallbackBulstat?: string,
): ResolvedCompany | null {
  const companyName =
    data.companyName?.name || data.companyNameTransliteration?.name || "";

  if (!companyName) {
    return null;
  }

  return {
    name: companyName,
    bulstat: normalizeEik(data.uic || fallbackBulstat),
    vatNumber: extractVatNumber(data),
    molName: extractManagerName(data),
    email: extractEmail(data),
    address: transformAddressFromCompanyData(data),
    source: "EXTERNAL",
  };
}

async function fetchExternalCompanyByEik(
  eik: string,
): Promise<CompanyData | null> {
  const apiKey = process.env.COMPANY_BOOK_API_KEY;

  if (!apiKey || !eik) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.companybook.bg/api/companies/${eik}?with_data=true`,
      {
        headers: {
          "X-API-Key": apiKey,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return (data.company || data) as CompanyData;
  } catch {
    return null;
  }
}

async function resolveFromDbByName(input: {
  role: CompanyRole;
  accountId: number;
  name?: string;
  organizationId?: number;
}): Promise<ResolvedCompany | null> {
  const query = normalizeText(input.name);
  if (!query) {
    return null;
  }

  if (input.role === "organization") {
    const organization = await prisma.organization.findFirst({
      where: {
        accountId: input.accountId,
        name: {
          contains: query,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        bulstat: true,
        vatNumber: true,
        molName: true,
        email: true,
        address: true,
      },
    });

    if (!organization?.bulstat) {
      return null;
    }

    return {
      organizationId: organization.id,
      name: organization.name,
      bulstat: organization.bulstat,
      vatNumber: organization.vatNumber,
      molName: organization.molName,
      email: organization.email,
      address: addressFromUnknown(organization.address),
      source: "DB",
    };
  }

  const contragent = await prisma.contragent.findFirst({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
      organization: {
        accountId: input.accountId,
      },
      ...(input.organizationId
        ? {
            organizationId: input.organizationId,
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      bulstat: true,
      vatNumber: true,
      molName: true,
      email: true,
      address: true,
      organizationId: true,
    },
  });

  if (!contragent?.bulstat) {
    return null;
  }

  return {
    contragentId: contragent.id,
    organizationId: contragent.organizationId,
    name: contragent.name,
    bulstat: contragent.bulstat,
    vatNumber: contragent.vatNumber,
    molName: contragent.molName,
    email: contragent.email,
    address: addressFromUnknown(contragent.address),
    source: "DB",
  };
}

async function resolveFromCacheByName(
  name?: string,
): Promise<ResolvedCompany | null> {
  const query = normalizeText(name);
  if (!query) {
    return null;
  }

  const cacheCompanyData = await prisma.companyRegistryCache.findFirst({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    orderBy: {
      lastFetchedAt: "desc",
    },
    select: {
      bulstat: true,
      name: true,
      vatNumber: true,
      address: true,
    },
  });

  if (!cacheCompanyData?.bulstat) {
    return null;
  }

  await prisma.companyRegistryCache.update({
    where: {
      bulstat: cacheCompanyData.bulstat,
    },
    data: {
      lastFetchedAt: new Date(),
    },
  });

  return {
    name: cacheCompanyData.name,
    bulstat: cacheCompanyData.bulstat,
    vatNumber: cacheCompanyData.vatNumber,
    molName: null,
    email: null,
    address: addressFromUnknown(cacheCompanyData.address),
    source: "CACHE",
  };
}

async function resolveFromDbByEik(input: {
  role: CompanyRole;
  accountId: number;
  eik?: string;
  organizationId?: number;
}): Promise<ResolvedCompany | null> {
  const eik = normalizeEik(input.eik);
  if (!eik) {
    return null;
  }

  if (input.role === "organization") {
    const organization = await prisma.organization.findFirst({
      where: {
        accountId: input.accountId,
        bulstat: eik,
      },
      select: {
        id: true,
        name: true,
        bulstat: true,
        vatNumber: true,
        molName: true,
        email: true,
        address: true,
      },
    });

    if (!organization?.bulstat) {
      return null;
    }

    return {
      organizationId: organization.id,
      name: organization.name,
      bulstat: organization.bulstat,
      vatNumber: organization.vatNumber,
      molName: organization.molName,
      email: organization.email,
      address: addressFromUnknown(organization.address),
      source: "DB",
    };
  }

  const contragent = await prisma.contragent.findFirst({
    where: {
      bulstat: eik,
      organization: {
        accountId: input.accountId,
      },
      ...(input.organizationId
        ? {
            organizationId: input.organizationId,
          }
        : {}),
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      bulstat: true,
      vatNumber: true,
      molName: true,
      email: true,
      address: true,
    },
  });

  if (!contragent?.bulstat) {
    return null;
  }

  return {
    contragentId: contragent.id,
    organizationId: contragent.organizationId,
    name: contragent.name,
    bulstat: contragent.bulstat,
    vatNumber: contragent.vatNumber,
    molName: contragent.molName,
    email: contragent.email,
    address: addressFromUnknown(contragent.address),
    source: "DB",
  };
}

async function resolveByEikWithFallback(input: {
  role: CompanyRole;
  accountId: number;
  eik?: string;
  organizationId?: number;
}): Promise<ResolvedCompany | null> {
  const eik = normalizeEik(input.eik);
  if (!eik) {
    return null;
  }

  const dbHit = await resolveFromDbByEik(input);
  if (dbHit) {
    return dbHit;
  }

  const cachedCompanyData = await getCachedCompanyData(eik);
  if (cachedCompanyData) {
    const mapped = mapCompanyData(cachedCompanyData, eik);
    if (mapped) {
      return {
        ...mapped,
        source: "CACHE",
      };
    }
  }

  const externalCompanyData = await fetchExternalCompanyByEik(eik);
  if (!externalCompanyData) {
    return null;
  }

  const mapped = mapCompanyData(externalCompanyData, eik);
  if (!mapped) {
    return null;
  }

  return mapped;
}

export async function POST(request: NextRequest) {
  const user = await getUserServer();

  if (!user?.sub) {
    return NextResponse.json({ data: null }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ResolveCompaniesBody;

    const organizationName = normalizeText(body.organizationName);
    const contragentName = normalizeText(body.contragentName);
    const organizationEik = normalizeEik(body.organizationEik);
    const contragentEik = normalizeEik(body.contragentEik);

    const accountMember = await prisma.accountMember.findFirst({
      where: {
        user: {
          auth_uid: user.sub,
        },
      },
      select: {
        accountId: true,
      },
    });

    if (!accountMember) {
      return NextResponse.json({ data: null }, { status: 404 });
    }

    const organizationFromDb = await resolveFromDbByName({
      role: "organization",
      accountId: accountMember.accountId,
      name: organizationName,
    });

    const organizationFromCache = organizationFromDb
      ? null
      : await resolveFromCacheByName(organizationName);

    let organization = organizationFromDb ?? organizationFromCache;

    if (!organization && organizationEik) {
      organization = await resolveByEikWithFallback({
        role: "organization",
        accountId: accountMember.accountId,
        eik: organizationEik,
      });
    }

    const contragentFromDb = await resolveFromDbByName({
      role: "contragent",
      accountId: accountMember.accountId,
      name: contragentName,
      organizationId: organizationFromDb?.organizationId,
    });

    const contragentFromCache = contragentFromDb
      ? null
      : await resolveFromCacheByName(contragentName);

    let contragent = contragentFromDb ?? contragentFromCache;

    if (!contragent && contragentEik) {
      contragent = await resolveByEikWithFallback({
        role: "contragent",
        accountId: accountMember.accountId,
        eik: contragentEik,
        organizationId: organizationFromDb?.organizationId,
      });
    }

    const missingEikFor: CompanyRole[] = [];

    if (organizationName && !organization && !organizationEik) {
      missingEikFor.push("organization");
    }

    if (contragentName && !contragent && !contragentEik) {
      missingEikFor.push("contragent");
    }

    return NextResponse.json(
      {
        data: {
          organization,
          contragent,
          missingEikFor,
          message: missingEikFor.length
            ? "Please write companies EIK's to find them"
            : null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[ai-assistant/resolve-companies] Error:", error);

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
