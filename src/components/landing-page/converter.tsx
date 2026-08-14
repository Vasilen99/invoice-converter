"use client";

import { useTranslations } from "next-intl";
import InvoiceUploader from "../InvoiceUploader";
import { FadeIn } from "../motion";

export const Converter = () => {
  const t = useTranslations("converter");
  return (
    <section id="converter" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <FadeIn className="text-center mb-10">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div className="bg-card border border-border rounded-3xl shadow-2xl shadow-foreground/10 p-8">
            <InvoiceUploader />
          </div>
        </FadeIn>
      </div>
    </section>
  );
};
