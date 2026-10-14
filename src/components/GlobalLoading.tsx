"use client";

import { useTranslations } from "next-intl";
import { useGlobalStore } from "@/store/global";
import "./GlobalLoading.css";

const LoadingGlobal = () => {
  const t = useTranslations("loading");
  const globalState = useGlobalStore();

  // Call all hooks unconditionally before conditional logic
  if (!globalState.isLoading) return null;

  return (
    <div className="fixed inset-x-0 bottom-5 z-99 flex justify-center pointer-events-none mx-auto">
      <div className="bg-secondary rounded-lg px-6 py-4 shadow-lg flex gap-1">
        <span className="text-secondary-foreground font-medium place-self-end">
          {t("text")}
        </span>
        <div className="loader place-self-center mt-2" />
      </div>
    </div>
  );
};
export default LoadingGlobal;
