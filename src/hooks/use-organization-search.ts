import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "./use-debounce";
import type { SearchResult } from "../../utility/types";

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

  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 8) {
      setResults([]);
      setError(null);
      return;
    }

    const cacheKey = `bulstat:${query}`;

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
        `/api/organizations/search?q=${encodeURIComponent(query)}`,
        {
          signal: abortControllerRef.current.signal,
        },
      );

      if (!response.ok) {
        if (response.status === 429) {
          setError("Rate limit exceeded. Please try again later.");
        } else if (response.status === 404) {
          setError("Company not found.");
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
  }, []);

  // Update search query
  const setSearchQueryValue = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Effect to handle debounced search
  useEffect(() => {
    if (debouncedQuery.trim().length >= 8) {
      performSearch(debouncedQuery.trim());
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
