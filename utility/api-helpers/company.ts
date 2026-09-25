/**
 * Shared company API helpers used across multiple route handlers.
 * Centralises external API calls and text normalisation utilities
 * that were previously duplicated in individual routes.
 */

import type { CompanyData } from "../types";
import {
  extractEmail,
  extractManagerName,
  extractVatNumber,
  transformAddressFromCompanyData,
} from "../company-registry-helpers";
import { normalizeEik, normalizeText, parseDecimal, toMoney } from "./common";

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

export { normalizeText, normalizeEik, parseDecimal, toMoney };

// ---------------------------------------------------------------------------
// External company API
// ---------------------------------------------------------------------------

export type ResolvedExternalCompany = {
  name: string;
  bulstat: string;
  vatNumber: string | null;
  molName: string | null;
  email: string | null;
  address: ReturnType<typeof transformAddressFromCompanyData> | undefined;
  rawLookupData: CompanyData;
};

/**
 * Fetches company data from the CompanyBook external API by EIK/BULSTAT.
 * Returns `null` when the API key is missing, the request fails, or no
 * company name is found.
 */
export async function fetchExternalCompanyByEik(
  eik: string,
): Promise<ResolvedExternalCompany | null> {
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
    const company = (data.company || data) as CompanyData;
    const companyName =
      company?.companyName?.name ||
      company?.companyNameTransliteration?.name ||
      "";

    if (!companyName) {
      return null;
    }

    return {
      name: companyName,
      bulstat: normalizeEik(company?.uic || eik),
      vatNumber: extractVatNumber(company),
      molName: extractManagerName(company) || null,
      email: extractEmail(company),
      address: transformAddressFromCompanyData(company),
      rawLookupData: company,
    };
  } catch {
    return null;
  }
}
