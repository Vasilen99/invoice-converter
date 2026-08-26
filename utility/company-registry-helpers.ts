import type { CompanyData } from "./types";

/**
 * Transforms raw CompanyData from the CompanyBook API into a standardized address format
 * Extracts only the relevant address fields from the seat data
 */
export function transformAddressFromCompanyData(company: CompanyData) {
  const seat = company.seat || {};

  return {
    country: seat.country || "",
    countryCode: seat.countryCode || "",
    district: seat.district || "",
    municipality: seat.municipality || "",
    settlement: seat.settlement || "",
    area: seat.area || "",
    street: seat.street || "",
    streetNumber: seat.streetNumber || "",
    block: seat.block || "",
    entrance: seat.entrance || "",
    floor: seat.floor || "",
    apartment: seat.apartment || "",
    postCode: seat.postCode || "",
  };
}

/**
 * Extracts VAT number from CompanyData registerInfo
 */
export function extractVatNumber(company: CompanyData): string | null {
  return company.registerInfo?.vat || null;
}

/**
 * Extracts manager name (MOL - Manage or Legal entity representative) from CompanyData
 */
export function extractManagerName(company: CompanyData): string {
  return company.managers?.[0]?.name || "";
}

/**
 * Validates and enriches organization data with information from rawLookupData
 * This is useful when we have full company data available in the registry cache
 */
export function enrichOrganizationDataFromRegistry(
  organizationData: {
    bulstat: string;
    legalName: string;
    vatNumber?: string | null;
    address?: Record<string, any>;
    molName?: string;
  },
  rawLookupData?: CompanyData | null,
) {
  if (!rawLookupData) {
    return organizationData;
  }

  // Only override fields that are empty in the incoming data
  const enrichedData = {
    bulstat: organizationData.bulstat,
    legalName:
      organizationData.legalName || rawLookupData.companyName?.name || "",
    vatNumber:
      organizationData.vatNumber ||
      extractVatNumber(rawLookupData) ||
      undefined,
    address:
      organizationData.address ||
      transformAddressFromCompanyData(rawLookupData),
    molName:
      organizationData.molName ||
      extractManagerName(rawLookupData) ||
      undefined,
  };

  return enrichedData;
}

/**
 * Validates that rawLookupData contains the expected CompanyData structure
 */
export function isValidCompanyData(data: any): data is CompanyData {
  return (
    data && typeof data === "object" && ("uic" in data || "companyName" in data)
  );
}

/**
 * Formats address data for database storage, handling JSON serialization
 * Returns null if address is empty, otherwise returns the formatted address object
 */
export function formatAddressForStorage(
  address: Record<string, any> | undefined | null,
) {
  if (!address) return undefined;

  return {
    country: address.country || "",
    countryCode: address.countryCode || "",
    district: address.district || "",
    municipality: address.municipality || "",
    settlement: address.settlement || "",
    area: address.area || "",
    street: address.street || "",
    streetNumber: address.streetNumber || "",
    block: address.block || "",
    entrance: address.entrance || "",
    floor: address.floor || "",
    apartment: address.apartment || "",
    postCode: address.postCode || "",
  } as const;
}

/**
 * Formats rawLookupData for database storage, ensuring it's properly serialized as JSON
 */
export function formatRawLookupDataForStorage(data: any) {
  if (!data) return null;
  // Prisma will handle JSON serialization, but we ensure it's clean
  return data;
}

/**
 * Validates organization data for manual entry
 * Returns an object with isValid flag and error messages if validation fails
 */
