import { NextRequest, NextResponse } from "next/server";
import type { CompanyBookSearchResponse } from "../../../../../utility/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const type = searchParams.get("type") || "legalName"; // "legalName" or "bulstat"
  const withData = searchParams.get("withData") === "true"; // Optional: full data retrieval

  if (!query || query.trim().length < 3) {
    return NextResponse.json(
      { error: "Query must be at least 3 characters long" },
      { status: 400 },
    );
  }

  const apiKey = process.env.COMPANY_BOOK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 },
    );
  }

  try {
    const baseUrl = "https://api.companybook.bg/api/v2/companies/search";
    const params = new URLSearchParams();

    if (type === "bulstat") {
      params.append("uic", query);
    } else {
      params.append("name", query);
    }

    params.append("limit", "20");
    params.append("status", "true"); // Only active companies

    if (withData) {
      params.append("with_data", "true");
    }

    const url = `${baseUrl}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`CompanyBook API error ${response.status}:`, errorBody);

      if (response.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 },
        );
      }

      if (response.status === 403) {
        return NextResponse.json(
          {
            error:
              "Access denied - API key may not have permission for full data retrieval. Try with_data=false or check your API key.",
            apiError: errorBody,
          },
          { status: 403 },
        );
      }

      throw new Error(
        `CompanyBook API error: ${response.status} - ${errorBody}`,
      );
    }

    const data: CompanyBookSearchResponse = await response.json();

    // If withData is requested, fetch full details for each company
    let results = data.results;

    if (withData) {
      console.log("Fetching full details for", results.length, "companies");
      results = await Promise.all(
        data.results.map(async (company) => {
          try {
            // Fetch full company data from the detailed endpoint
            const detailUrl = `https://api.companybook.bg/api/companies/${company.uic}`;
            console.log("Fetching details from:", detailUrl);

            const detailResponse = await fetch(detailUrl, {
              headers: {
                "X-API-Key": apiKey,
              },
            });

            console.log(
              `Detail response status for ${company.uic}:`,
              detailResponse.status,
            );

            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              console.log(
                "Full company details for",
                company.uic,
                ":",
                JSON.stringify(detailData, null, 2),
              );

              // Merge search result with full details from company object
              const mergedCompany = {
                ...company,
                ...(detailData.company || {}),
                history: detailData.history,
                daughters: detailData.daughters,
              };

              console.log(
                "Merged company:",
                JSON.stringify(mergedCompany, null, 2),
              );
              return mergedCompany;
            } else {
              const errorText = await detailResponse.text();
              console.error(
                `Failed to fetch details for ${company.uic}:`,
                detailResponse.status,
                errorText,
              );
            }
          } catch (error) {
            console.error(
              `Error fetching details for company ${company.uic}:`,
              error,
            );
          }

          return company;
        }),
      );
    } else {
      console.log("withData is false, returning basic search results only");
    }

    // Transform the response
    const transformedResults = results.map((company) => {
      console.log(
        "Transformed company object:",
        JSON.stringify(company, null, 2),
      );

      // Extract molName (manager name) from first manager if available
      const molName = company.managers?.[0]?.name || "";

      // Use seat address as primary, fallback to address field
      const addressData = company.seat || company.address || {};

      const result: any = {
        // Basic info
        bulstat: company.uic,
        legalName: company.name,
        legalForm: company.legalForm,
        status: company.status,
        district: company.district,
        vatRegistered: company.vatRegistered,
        transliteration: company.transliteration,
        lastUpdated: company.lastUpdated,

        // Contact presence flags
        contactPresence: company.contactPresence,

        // Financial info
        activeFinancialYear: company.activeFinancialYear,
        latestRevenue: company.latestRevenue,

        // Management
        molName,
        address: addressData,

        // Full data from API
        rawLookupData: company,
      };

      // Add all additional fields if they exist (from full data fetch)
      if (company.email) result.email = company.email;
      if (company.phone) result.phone = company.phone;
      if (company.fax) result.fax = company.fax;
      if (company.website) result.website = company.website;
      if (company.managers) result.managers = company.managers;
      if (company.representatives)
        result.representatives = company.representatives;
      if (company.boardOfDirectors)
        result.boardOfDirectors = company.boardOfDirectors;
      if (company.correspondenceSeat)
        result.correspondenceSeat = company.correspondenceSeat;
      if (company.subjectOfActivity)
        result.subjectOfActivity = company.subjectOfActivity;
      if (company.nkids) result.nkids = company.nkids;
      if (company.capital) result.capital = company.capital;
      if (company.partners) result.partners = company.partners;
      if (company.registerInfo) result.registerInfo = company.registerInfo;
      if (company.contacts) result.contacts = company.contacts;
      if (company.history) result.history = company.history;
      if (company.daughters) result.daughters = company.daughters;

      return result;
    });

    return NextResponse.json({
      results: transformedResults,
      total: data.total,
      totalCount: data.totalCount,
      hasMoreTotal: data.hasMoreTotal,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Failed to search organizations" },
      { status: 500 },
    );
  }
}
