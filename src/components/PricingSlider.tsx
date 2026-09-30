"use client";

import { FadeIn } from "./motion";
import { Slider } from "./ui/slider";
import { ArrowRight, Euro } from "lucide-react";
import { Button } from "@base-ui/react";
import { useUserStore } from "@/store/user";
import { useGlobalStore } from "@/store/global";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { creditsLink } from "@/utility/links";
import { useTranslations } from "next-intl";
import {
  ALLOWED_CREDIT_VALUES,
  calculateCreditPrice,
  CREDIT_BASE_PRICE_PER_CREDIT,
} from "@/utility/credit-pricing";
import { callApi } from "@/utility/hooks/apiFetch";

const LoginModal = dynamic(() => import("./LoginModal"), { ssr: false });

type PackageData = {
  id: number;
  name: string;
  priceAmount: string;
  currency: string;
};
export const PricingSlider = ({
  packageData,
  layout,
}: {
  packageData?: PackageData | null;
  layout: "dashboard" | "landing";
}) => {
  const t = useTranslations("pricing");
  const [sliderIndex, setSliderIndex] = useState(0);

  const selectedCredits =
    ALLOWED_CREDIT_VALUES[sliderIndex] ?? ALLOWED_CREDIT_VALUES[0];
  const pricing = useMemo(() => {
    return (
      calculateCreditPrice(selectedCredits) ??
      calculateCreditPrice(ALLOWED_CREDIT_VALUES[0])
    );
  }, [selectedCredits]);

  const selectedTier = useMemo(() => {
    if (selectedCredits <= 100) {
      return { name: "tierStarter", desc: "tierStarterDesc" };
    }

    if (selectedCredits <= 300) {
      return { name: "tierMedium", desc: "tierMediumDesc" };
    }

    return { name: "tierEnterprise", desc: "tierEnterpriseDesc" };
  }, [selectedCredits]);

  const { user } = useUserStore();
  const { isLoginModalOpen, setIsLoginModalOpen } = useGlobalStore();
  const pathname = usePathname();
  const router = useRouter();
  const sliderPercentage =
    (sliderIndex / (ALLOWED_CREDIT_VALUES.length - 1)) * 100;

  const handlePayment = async () => {
    if (!pricing) {
      return;
    }

    const data = await callApi("/payment/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          package_id: packageData?.id ?? 1,
          credits_amount: pricing.credits,
        },
      }),
    });

    if (data?.url) {
      window.location.href = data.url;
    }
  };
  const handleButtonClick = () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    } else if (redirectUrl) {
      return router.push(redirectUrl);
    } else {
      return handlePayment();
    }
  };
  const redirectUrl = pathname === "/" && user ? creditsLink : null;

  return (
    <>
      <FadeIn
        className={`mb-14 ${layout === "landing" ? "flex items-center justify-center" : ""} `}
      >
        <div className="relative w-full max-w-xs">
          <div
            className="absolute -top-10 flex justify-center pointer-events-none transition-all duration-75"
            style={{ left: `calc(${sliderPercentage}% - 21px)` }}
          >
            <div className="bg-primary text-primary-foreground text-sm font-semibold px-3 py-2 rounded-full">
              {selectedCredits}
            </div>
          </div>
          <Slider
            min={0}
            max={ALLOWED_CREDIT_VALUES.length - 1}
            step={1}
            value={[sliderIndex]}
            onValueChange={(values) => {
              const nextIndex = Array.isArray(values) ? values[0] : values;
              setSliderIndex(nextIndex);
            }}
            className="w-full"
          />
        </div>
      </FadeIn>
      <FadeIn
        className={`mb-14 ${layout === "landing" ? "flex items-center justify-center" : ""} `}
      >
        <div className="grid grid-cols-1 place-items-center place-content-center gap-8 bg-muted/30 rounded-2xl p-8 md:p-12 w-fit">
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4 text-center">
                {t(selectedTier.name)}
              </h3>
              <p className="text-muted-foreground mb-4 text-center">
                {t(selectedTier.desc)}
              </p>
            </div>
            <div className="mb-4">
              <div className="flex items-baseline gap-1 justify-center">
                <span className="text-4xl md:text-5xl font-bold text-foreground">
                  {pricing?.finalPrice.toFixed(2)}
                </span>
                <Euro className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="mb-6 space-y-1 text-center">
              <p className="text-muted-foreground text-sm">
                {t("perCreditLabel")}: €{pricing?.pricePerCredit.toFixed(3)}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("basePriceLabel")}: €
                {(selectedCredits * CREDIT_BASE_PRICE_PER_CREDIT).toFixed(2)}
              </p>
              {pricing && pricing.discountAmount >= 1 && (
                <p className="text-primary text-sm font-semibold">
                  {t("saveLabel", {
                    percent: Math.round(pricing.discountPercent),
                    amount: pricing.discountAmount.toFixed(2),
                  })}
                </p>
              )}
            </div>
            <Button
              onClick={() => handleButtonClick()}
              className="mx-auto w-fit hover:cursor-pointer relative btn-glow inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all group"
            >
              {t("button")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
          <div className="flex flex-col">
            <span className="text-foreground">
              {t("creditsCount")}: {selectedCredits}
            </span>
            <span className="text-muted-foreground text-sm">
              {t("totalLabel")}: €{pricing?.finalPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </FadeIn>
      {isLoginModalOpen && (
        <LoginModal
          open={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      )}
    </>
  );
};
