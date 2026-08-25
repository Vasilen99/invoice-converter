"use client";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { useOrganizationSearch } from "@/hooks/use-organization-search";
import type { SearchResult } from "@/hooks/use-organization-search";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function SearchOrganizations({
  onSelectResult,
}: {
  onSelectResult?: (result: SearchResult) => void;
}) {
  const t = useTranslations();
  const { searchQuery, setSearchQuery, results, isLoading, error } =
    useOrganizationSearch();

  const handleResultClick = (result: SearchResult) => {
    if (onSelectResult) {
      onSelectResult(result);
      setSearchQuery(""); // Clear search after selection
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="relative">
        <Input
          placeholder={t("organizations.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results.length > 0 && searchQuery.trim().length >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="flex flex-col gap-2 max-h-96 overflow-y-auto border border-border rounded-lg"
        >
          {results.map((result, index) => (
            <motion.button
              key={`${result.bulstat}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleResultClick(result)}
              className="flex flex-col gap-1 items-start p-3 hover:bg-muted transition-colors text-left border-b border-border last:border-b-0"
            >
              <span className="font-medium text-sm">{result.legalName}</span>
              <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                <span className="font-mono bg-background/50 px-2 py-1 rounded">
                  {result.bulstat}
                </span>
                {result.district && (
                  <span className="bg-background/50 px-2 py-1 rounded">
                    {result.district}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {!isLoading &&
        searchQuery.trim().length >= 3 &&
        results.length === 0 &&
        !error && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("organizations.noResults")}
          </p>
        )}
    </div>
  );
}
