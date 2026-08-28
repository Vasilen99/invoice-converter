import { prisma } from "./prisma";
import type { CompanyData } from "./types";
import { isValidCompanyData } from "./company-registry-helpers";

/**
 * Retrieves cached company data from the registry by BULSTAT
 * Useful for reusing API data without calling external services
 */
export async function getCachedCompanyData(
  bulstat: string,
): Promise<CompanyData | null> {
  try {
    const cached = await prisma.companyRegistryCache.findUnique({
      where: { bulstat },
    });

    if (!cached || !cached.rawLookupData) {
      return null;
    }

    // Update lastFetchedAt when we hit the cache
    await prisma.companyRegistryCache.update({
      where: { bulstat },
      data: { lastFetchedAt: new Date() },
    });
    
    // Validate that the cached data is valid CompanyData
    if (isValidCompanyData(cached.rawLookupData)) {
      return cached.rawLookupData as CompanyData;
    }

    console.warn(
      `[Registry Cache] Invalid cached data format for BULSTAT ${bulstat}`,
    );
    return null;
  } catch (error) {
    console.error(
      `[Registry Cache] Error retrieving cached data for BULSTAT ${bulstat}:`,
      error,
    );
    return null;
  }
}
