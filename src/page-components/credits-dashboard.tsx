"use client";
import { HeadingSection } from "@/components/HeadingSection";
import NoAccountFallback from "@/components/NoAccountFallback";
import { PricingSlider } from "@/components/PricingSlider";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useGlobalStore } from "@/store/global";
import { Decimal } from "@prisma/client/runtime/index-browser";

type CreditsPageProps = {
  accountData: {
    id: number;
    creditBalance: number;
  } | null;
  packageData: {
    id: number;
    name: string;
    priceAmount: string;
  } | null;
};

const CreditsPage = ({ accountData, packageData }: CreditsPageProps) => {
  const t = useTranslations("creditsPage");
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const sessionId = searchParams.get("session_id");
  const { setAlertStatus } = useGlobalStore();

  useEffect(() => {
    if (sessionId && status) {
      if (status === "success") {
        setAlertStatus({
          status: "success",
          statusHeader: t("payment.paymentSuccess"),
          statusContent: t("payment.paymentSuccessMessage"),
        });
      } else if (status === "failed") {
        setAlertStatus({
          status: "error",
          statusHeader: t("payment.paymentFailed"),
          statusContent: t("payment.paymentFailedMessage"),
        });
      }
    }
  }, [sessionId, status, setAlertStatus]);

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
          <PricingSlider layout="dashboard" packageData={packageData} />
        </>
      )}
    </>
  );
};

export default CreditsPage;
