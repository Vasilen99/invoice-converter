"use client";
import { useTranslations } from "next-intl";
import { PricingSlider } from "../PricingSlider";
import { HeadingSection } from "../HeadingSection";

export const Pricing = () => {
  const t = useTranslations("pricing");

  return (
    <section id="pricing" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <HeadingSection
          title={t("title")}
          subtitle={t("subtitle")}
          type="landing-section"
        />
        <PricingSlider layout="landing" />
      </div>
    </section>
  );
};
