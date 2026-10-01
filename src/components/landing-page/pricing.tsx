"use client";
import { useTranslations } from "next-intl";
import { FadeIn } from "../motion";
import { PricingSlider } from "../PricingSlider";

export const Pricing = () => {
  const t = useTranslations("pricing");

  return (
    <section id="solution" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("subtitle")}
          </p>
        </FadeIn>
        <PricingSlider layout="landing" />
      </div>
    </section>
  );
};
