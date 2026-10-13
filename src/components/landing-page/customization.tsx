"use client";
import { useTranslations } from "next-intl";
import { FadeIn, Stagger, StaggerItem } from "../motion";
import { Copy, Brain, FileText, Zap, CheckCircle, Repeat } from "lucide-react";
import { useUserStore } from "@/store/user";
import { useGlobalStore } from "@/store/global";
import { invoiceTemplateLink } from "@/utility/links";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/button";

const customizationIcons = {
  extract: Copy,
  aiPowered: Brain,
  upload: FileText,
  fast: Zap,
  reuse: CheckCircle,
  consistency: Repeat,
};

const customizationKeys = [
  "extract",
  "aiPowered",
  "upload",
  "fast",
  "reuse",
  "consistency",
] as const;

export const Customization = () => {
  const t = useTranslations("customization");
  const { user } = useUserStore();
  const { setIsLoginModalOpen } = useGlobalStore();

  const handleCta = () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    window.location.href = invoiceTemplateLink;
  };

  return (
    <section id="customization" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("subtitle")}
          </p>
        </FadeIn>

        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {customizationKeys.map((key) => {
            const Icon = customizationIcons[key];
            return (
              <StaggerItem key={key}>
                <div className="glass rounded-2xl p-6 h-full flex gap-4 group hover:bg-accent/40 transition-colors">
                  <div className="w-11 h-11 shrink-0 rounded-xl bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-foreground/70" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">
                      {t(`items.${key}.title`)}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t(`items.${key}.desc`)}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>

        <FadeIn className="flex justify-center">
          <Button
            onClick={() => handleCta()}
            className="mt-6 mx-auto w-fit hover:cursor-pointer relative btn-glow inline-flex items-center justify-center gap-2 px-10 py-6 rounded-lg text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all group"
          >
            {t("cta")}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </FadeIn>
      </div>
    </section>
  );
};
