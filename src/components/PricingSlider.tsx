"use client";

import { FadeIn } from "./motion";
import { Slider } from "./ui/slider";
import { ArrowRight, Euro } from "lucide-react";
import { Button } from "@base-ui/react";
import { useUserStore } from "@/store/user";
import { useGlobalStore } from "@/store/global";
import { PRICING_TIERS } from "@/utility/constants";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { creditsLink } from "@/utility/links";
import { useTranslations } from "next-intl";
import { Decimal } from "@prisma/client/runtime/index-browser";

const LoginModal = dynamic(() => import("./LoginModal"), { ssr: false });

type PackageData = {
  id: number;
  name: string;
  priceAmount: string;
};
export const PricingSlider = ({
  packageData,
  layout,
}: {
  packageData?: PackageData | null;
  layout: "dashboard" | "landing";
}) => {
  const t = useTranslations("pricing");
  const [value, setValue] = useState([10]);
  const [selectedTier, setSelectedTier] = useState(PRICING_TIERS[0]);
  const [price, setPrice] = useState(
    packageData ? Number(packageData.priceAmount).toFixed(2) : 4.0,
  );
  const { user } = useUserStore();
  const { isLoginModalOpen, setIsLoginModalOpen } = useGlobalStore();
  const pathname = usePathname();
  const router = useRouter();
  const sliderPercentage = (value[0] / 100) * 100;
  useEffect(() => {
    if (value[0] < 10) {
      setValue([10]);
      setSelectedTier(PRICING_TIERS[0]);
      setPrice(3.0);
    }
    if (value[0] >= 10 && value[0] < 50) {
      setSelectedTier(PRICING_TIERS[0]);
      setPrice((3 * value[0] + 10) / 10);
    }
    if (value[0] >= 50 && value[0] < 90) {
      setSelectedTier(PRICING_TIERS[1]);
      setPrice((2.5 * value[0] + 10) / 10);
    }
    if (value[0] >= 90) {
      setSelectedTier(PRICING_TIERS[2]);
      setPrice((2 * value[0] + 10) / 10);
    }
  }, [value]);

  const handlePayment = async () => {
    try {
      const response = await fetch("/api/payment/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            package_id: 1, // Replace with the actual package ID
            price: price,
            credits_amount: value[0],
          },
        }),
      });
      const data = await response.json();
      if (data?.data?.url) {
        window.location.href = data.data.url;
      }
    } catch (err) {
      console.error("Payment session error:", err);
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
              {value[0]}
            </div>
          </div>
          <Slider
            value={value}
            max={100}
            step={10}
            onValueChange={(val) => setValue(Array.isArray(val) ? val : [val])}
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
                  {price}
                </span>
                <Euro className="w-6 h-6 text-primary" />
              </div>
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
              {t("creditsCount")}: {value[0]}
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
