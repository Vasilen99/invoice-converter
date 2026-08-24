"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "../i18n/actions";
import type { Locale } from "../i18n/request";

const LanguageSwitcher = () => {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
    });
  };

  return (
    <div className="flex items-center rounded-lg glass overflow-hidden text-xs font-semibold">
      {(["bg", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          disabled={isPending}
          className={`px-2.5 py-1.5 uppercase transition-colors ${
            locale === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:cursor-pointer"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
