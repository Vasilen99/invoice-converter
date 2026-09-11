"use client";
import { Check } from "lucide-react";
import React, { memo } from "react";
import DividerComponent from "./DividerComponent";
import { useTranslations } from "next-intl";
type StepsIndicatorProps = {
  currentStep: number;
  layout?: "create-appointment";
};

const StepsIndicator = ({ currentStep, layout }: StepsIndicatorProps) => {
  const t = useTranslations("createInvoice");
  const STEPS = [t("steps.step1"), t("steps.step2"), t("steps.step3")];

  return (
    <>
      <div
        className={`flex w-[calc(100%-100px)] lg:w-[85%] mx-auto  ${layout === "create-appointment" ? "" : "lg:mt-6 mt-0"}`}
      >
        {STEPS.map((_, index) => (
          <React.Fragment key={index}>
            <div className="grid grid-rows-[min-content_max-content]">
              <div
                className={`rounded-full w-10 h-10 items-center justify-center flex m-auto  ${currentStep >= index + 1 ? "bg-primary text-primary-foreground" : "border border-base-200 text-primary"}`}
                data-testid={`step-${index + 1}-circle`}
              >
                {currentStep > index + 1 ? <Check /> : index + 1}
              </div>
            </div>

            {index !== 2 ? <DividerComponent addServiceStepsDivider /> : null}
          </React.Fragment>
        ))}
      </div>
      <div
        className={`flex w-full lg:w-[91%] justify-between mx-auto ${layout === "create-appointment" ? "" : "mb-12"}`}
      >
        {STEPS.map((step, index) => (
          <React.Fragment key={index}>
            <span className="text-primary! text-xs! text-center max-w-32.5 lg:hidden block">
              {currentStep === index + 1 ? step : null}
            </span>

            <h4
              className="mt-1 text-center max-w-32.5 hidden lg:block"
              data-testid={`step-${index + 1}-text-desktop`}
            >
              {step}
            </h4>
          </React.Fragment>
        ))}
      </div>
    </>
  );
};

export default memo(StepsIndicator);
