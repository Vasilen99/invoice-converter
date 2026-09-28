"use client";
import { HeadingSection } from "@/components/HeadingSection";
import NoAccountFallback from "@/components/NoAccountFallback";
import { PricingSlider } from "@/components/PricingSlider";
import { useTranslations } from "next-intl";

type CreditsPageProps = {
  accountData: {
    id: number;
    creditBalance: number;
  } | null;
};
const CreditsPage = ({ accountData }: CreditsPageProps) => {
  const t = useTranslations("creditsPage");
  return (
    <>
      {!accountData ? (
        <NoAccountFallback />
      ) : (
        <>
          <HeadingSection title={t("header")} subtitle={t("subheader")} />
          <span className="flex justify-start w-full mb-16">
            {t("creditsBalance")}:{" "}
            <span className="font-bold ml-2">
              {accountData?.creditBalance ?? 0}
            </span>
          </span>
          <PricingSlider />
        </>
      )}
    </>
  );
};

export default CreditsPage;
