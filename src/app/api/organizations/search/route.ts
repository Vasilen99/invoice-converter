import { NextRequest, NextResponse } from "next/server";
import type { SearchResult, CompanyData } from "../../../../../utility/types";
import { getCachedCompanyData } from "../../../../../utility/registry-cache";
import {
  extractManagerName,
  extractVatNumber,
  transformAddressFromCompanyData,
} from "../../../../../utility/company-registry-helpers";

/**
 * Transforms raw CompanyData into SearchResult format
 */
function transformCompanyToSearchResult(company: CompanyData): SearchResult {
  const vatNumber = extractVatNumber(company);
  const molName = extractManagerName(company);
  const address = transformAddressFromCompanyData(company);

  return {
    bulstat: company.uic,
    legalName: company.companyName?.name || "",
    legalForm: company.legalForm,
    status: company.status,
    address,
    molName,
    vatNumber,
    transliteration: company.companyNameTransliteration?.name,
    lastUpdated: company.lastUpdated,
    rawLookupData: company,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length < 9) {
    return NextResponse.json(
      {
        error: "organizations.searchQueryTooShort",
        results: [],
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.COMPANY_BOOK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "errorMessagesCommon.serverErrorMessage", results: [] },
      { status: 500 },
    );
  }

  try {
    const cachedData = await getCachedCompanyData(query);

    if (cachedData) {
      const searchResult = transformCompanyToSearchResult(cachedData);

      return NextResponse.json({
        results: [searchResult],
      });
    }

    // Hit the individual company endpoint using UIC for full data
    const url = `https://api.companybook.bg/api/companies/${query}?with_data=true`;

    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`CompanyBook API error ${response.status}:`, errorBody);

      if (response.status === 429) {
        // Rate limited - try cache as fallback
        const cachedData = await getCachedCompanyData(query);
        if (cachedData) {
          const searchResult = transformCompanyToSearchResult(cachedData);
          return NextResponse.json({
            results: [searchResult],
          });
        }

        return NextResponse.json(
          { error: "organizations.rateLimitExceeded", results: [] },
          { status: 429 },
        );
      }

      if (response.status === 404) {
        return NextResponse.json(
          { error: "organizations.companyNotFound", results: [] },
          { status: 404 },
        );
      }

      throw new Error(
        `CompanyBook API error: ${response.status} - ${errorBody}`,
      );
    }

    const data = await response.json();
    console.log(data, "Organization Data with new api");

    // Transform the response
    const company = data.company || data;
    const searchResult = transformCompanyToSearchResult(company);

    return NextResponse.json({
      results: [searchResult],
    });
  } catch (error) {
    console.error("[Search] Error during company search:", error);

    // Last resort: try to get from cache
    try {
      const cachedData = await getCachedCompanyData(query);
      if (cachedData) {
        const searchResult = transformCompanyToSearchResult(cachedData);
        return NextResponse.json({
          results: [searchResult],
        });
      }
    } catch (cacheError) {
      console.error("[Search] Error accessing cache as fallback:", cacheError);
    }

    return NextResponse.json(
      { error: "errorMessagesCommon.serverErrorMessage", results: [] },
      { status: 500 },
    );
  }
}
