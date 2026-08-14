'use client'

import { ArrowRight } from "lucide-react";
import { FadeIn } from "../motion";
import { useTranslations } from "next-intl";

export const FinalCta = () => {
  const t = useTranslations("finalCta");
  return (
    <section className="relative py-18 px-4">
      <FadeIn className="max-w-4xl mx-auto">
        <div className="relative glass rounded-3xl p-12 sm:p-16 text-center overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-foreground/10 blur-[100px]" />
          <h2 className="relative text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="relative text-muted-foreground mb-8">{t("subtitle")}</p>
          <a
            href="#converter"
            className="relative btn-glow inline-flex items-center gap-2 px-10 py-4 rounded-2xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all group"
          >
            {t("button")}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </FadeIn>
    </section>
  );
}