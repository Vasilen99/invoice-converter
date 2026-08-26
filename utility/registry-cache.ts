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

/**
 * Gets or creates a registry cache entry
 * Useful for ensuring a registry entry exists
 */
export async function getOrCreateRegistryCache(
  bulstat: string,
  legalName: string,
  rawLookupData?: CompanyData,
) {
  try {
    const registry = await prisma.companyRegistryCache.upsert({
      where: { bulstat },
      update: {
        lastFetchedAt: new Date(),
      },
      create: {
        bulstat,
        legalName,
        rawLookupData: rawLookupData ? rawLookupData : undefined,
      },
    });

    return registry;
  } catch (error) {
    console.error(
      `[Registry Cache] Error upserting cache for BULSTAT ${bulstat}:`,
      error,
    );
    throw error;
  }
}

/**
 * Updates the lastFetchedAt timestamp for a registry cache entry
 * Useful for tracking when data was last refreshed
 */
export async function updateRegistryCacheTimestamp(bulstat: string) {
  try {
    await prisma.companyRegistryCache.update({
      where: { bulstat },
      data: {
        lastFetchedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(
      `[Registry Cache] Error updating timestamp for BULSTAT ${bulstat}:`,
      error,
    );
    // Don't throw - this is not critical
  }
}

/**
 * Checks if a registry cache entry exists and if it's stale
 * Considers data stale if not updated within the specified days
 */
export async function isRegistryCacheStale(
  bulstat: string,
  staleDays: number = 30,
): Promise<boolean> {
  try {
    const cached = await prisma.companyRegistryCache.findUnique({
      where: { bulstat },
      select: { lastFetchedAt: true },
    });

    if (!cached) return true;

    const staleDateThreshold = new Date();
    staleDateThreshold.setDate(staleDateThreshold.getDate() - staleDays);

    return cached.lastFetchedAt < staleDateThreshold;
  } catch (error) {
    console.error(
      `[Registry Cache] Error checking cache staleness for BULSTAT ${bulstat}:`,
      error,
    );
    return true; // Consider stale on error
  }
}
