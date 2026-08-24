"use client";

import React, { useEffect } from "react";
import { useUserStore } from "@/store/user";
import { useTranslations } from "next-intl";
import { setTranslationFunction } from "../../utility/hooks/apiFetch";
import { createClient } from "../../utility/supabase/client";

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { fetchUser } = useUserStore();
  const t = useTranslations();

  useEffect(() => {
    // Initialize translation function for API calls
    setTranslationFunction(t);
  }, [t]);

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes (login/logout)
    // INITIAL_SESSION: User is already authenticated (e.g., after OAuth callback)
    // SIGNED_IN: User just signed in during the session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // When auth state changes and user is authenticated, fetch their data
      // For INITIAL_SESSION (page load with existing session): fetch regardless
      // For SIGNED_IN (just authenticated): fetch user data
      if (
        (event === "INITIAL_SESSION" || event === "SIGNED_IN") &&
        session?.user
      ) {
        fetchUser();
      } else if (event === "SIGNED_OUT") {
        useUserStore.setState({ user: null });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUser]);

  return <>{children}</>;
};

export default AppProvider;
