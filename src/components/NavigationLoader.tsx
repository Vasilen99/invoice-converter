"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useGlobalStore } from "@/store/global";

/**
 * NavigationLoader - Tracks route changes and shows loading indicator
 * Uses Zustand getState() to avoid hook ordering issues with React Compiler
 */
function NavigationLoaderContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // When pathname or search params change, turn off loading
    const { setIsLoading } = useGlobalStore.getState();
    setIsLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    // Also listen for hash changes to turn off loading
    const handleHashChange = () => {
      const { setIsLoading } = useGlobalStore.getState();
      setIsLoading(false);
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    // Set up event listener for link clicks
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (!link) return; // Check if it's an internal link (not external, not hash, not download)

      const href = link.getAttribute("href");
      if (!href) return; // Skip hash links (same page navigation) - check this FIRST

      if (href.startsWith("#")) return; // Skip external links

      if (href.startsWith("http") && !href.startsWith(window.location.origin)) {
        return;
      } // Skip download links

      if (link.hasAttribute("download")) return; // Skip links that open in new tab

      if (link.getAttribute("target") === "_blank") return; // Skip mailto and tel links

      if (href.startsWith("mailto:") || href.startsWith("tel:")) return; // Check if it's a different page (not just query param change)

      const currentPath = window.location.pathname;
      const newPath = href.split("?")[0].split("#")[0]; // Only show loading if navigating to a different page

      if (newPath !== currentPath && newPath !== "") {
        const { setIsLoading } = useGlobalStore.getState();
        setIsLoading(true);
      }
    }; // Add click listener to document

    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handlePopState = () => {
      const { setIsLoading } = useGlobalStore.getState();
      setIsLoading(true); // Clear any previous timeout

      if (timeoutId) clearTimeout(timeoutId); // Fallback timeout - pathname change should stop loading, but this ensures it

      timeoutId = setTimeout(() => {
        const { setIsLoading: setLoading } = useGlobalStore.getState();
        setLoading(false);
      }, 300);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}

const NavigationLoader = dynamic(
  () => Promise.resolve(NavigationLoaderContent),
  {
    ssr: false,
    loading: () => null,
  },
);

export default NavigationLoader;
