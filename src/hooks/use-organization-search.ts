import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "./use-debounce";

export interface SearchResult {
  bulstat: string | null;
  legalName: string;
  legalForm?: string;
  status?: string;
  district?: string;
  vatRegistered?: boolean;
  transliteration?: string;
  contactPresence?: {
    email: boolean;
    phone: boolean;
    website: boolean;
  };
  activeFinancialYear?: number;
  latestRevenue?: string;
  molName?: string;
  address?: {
    country?: string;
    region?: string;
    district?: string;
    municipality?: string;
    settlement?: string;
    area?: string;
    street?: string;
    streetNumber?: string;
    block?: string;
    entrance?: string;
    floor?: string;
    apartment?: string;
    postCode?: string;
  };
  rawLookupData?: {
    uic: string;
    name: string;
    legalForm: string;
    status: string;
    district: string;
    transliteration: string;
    vatRegistered: boolean;
    contactPresence?: {
      email: boolean;
      phone: boolean;
      website: boolean;
    };
    activeFinancialYear?: number;
    latestRevenue?: string;
    managers?: Array<{
      name: string;
      indent: string;
      address: string;
    }>;
    seat?: {
      country?: string;
      region?: string;
      district?: string;
      municipality?: string;
      settlement?: string;
      area?: string;
      street?: string;
      streetNumber?: string;
      block?: string;
      entrance?: string;
      floor?: string;
      apartment?: string;
      postCode?: string;
    };
    address?: {
      country?: string;
      region?: string;
      district?: string;
      municipality?: string;
      settlement?: string;
      area?: string;
      street?: string;
      streetNumber?: string;
      block?: string;
      entrance?: string;
      floor?: string;
      apartment?: string;
      postCode?: string;
    };
  };
}

interface SearchCache {
  [key: string]: SearchResult[];
}

export function useOrganizationSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<SearchCache>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(searchQuery, 500);

  const performSearch = useCallback(
    async (query: string, type: "legalName" | "bulstat" = "legalName") => {
      if (query.trim().length < 3) {
        setResults([]);
        setError(null);
        return;
      }

      const cacheKey = `${type}:${query}`;

      // Check cache
      if (cacheRef.current[cacheKey]) {
        setResults(cacheRef.current[cacheKey]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(
          `/api/organizations/search?q=${encodeURIComponent(query)}&type=${type}&withData=true`,
          {
            signal: abortControllerRef.current.signal,
          },
        );

        if (!response.ok) {
          if (response.status === 429) {
            setError("Rate limit exceeded. Please try again later.");
          } else {
            setError("Failed to search organizations");
          }
          setResults([]);
          setIsLoading(false);
          return;
        }

        const data = await response.json();

        // Cache the results
        cacheRef.current[cacheKey] = data.results;
        setResults(data.results);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Search error:", err);
          setError("Failed to search organizations");
          setResults([]);
        }
        setIsLoading(false);
      }
    },
    [],
  );

  // Update search query
  const setSearchQueryValue = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Effect to handle debounced search
  useEffect(() => {
    if (debouncedQuery.trim().length >= 3) {
      // Determine if query is BULSTAT (10-13 digits, may contain BG prefix)
      const isBulstat = /^(BG)?\d{10,13}$/.test(debouncedQuery.trim());
      performSearch(debouncedQuery.trim(), isBulstat ? "bulstat" : "legalName");
    } else if (debouncedQuery.trim().length === 0) {
      setResults([]);
      setError(null);
    }
  }, [debouncedQuery, performSearch]);

  return {
    searchQuery,
    setSearchQuery: setSearchQueryValue,
    results,
    isLoading,
    error,
    clearCache: () => {
      cacheRef.current = {};
    },
  };
}
