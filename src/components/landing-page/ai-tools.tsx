"use client";
import { useTranslations } from "next-intl";
import { Stagger, StaggerItem } from "../motion";
import { Zap, MessageSquare, ArrowRight } from "lucide-react";
import { useUserStore } from "@/store/user";
import { useGlobalStore } from "@/store/global";
import { aiAssistantLink, aiConvertorLink } from "@/utility/links";
import { Button } from "../ui/button";
import { HeadingSection } from "../HeadingSection";
const toolIcons = [Zap, MessageSquare];
const toolKeys = ["converter", "assistant"] as const;

export const AITools = () => {
  const t = useTranslations("aiTools");
  const { user } = useUserStore();
  const { setIsLoginModalOpen } = useGlobalStore();
  const handleCta = (toolKey?: string) => {
    if (!toolKey) return;
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    const toolPath =
      toolKey === "converter" ? aiConvertorLink : aiAssistantLink;
    window.location.href = toolPath;
  };
  return (
    <section id="ai-tools" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <HeadingSection
          title={t("title")}
          subtitle={t("subtitle")}
          type="landing-section"
        />
        <Stagger
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          staggerDelay={0.2}
        >
          {toolKeys.map((key, i) => {
            const Icon = toolIcons[i];
            return (
              <StaggerItem key={key}>
                <div className="relative glass rounded-2xl p-8 h-full flex flex-col gap-6 group hover:bg-accent/40 transition-colors border border-transparent hover:border-accent/20">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-4 flex-1">
                      <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-accent group-hover:scale-110 transition-all">
                        <Icon className="w-6 h-6 text-foreground/70" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                          {t(`tools.${key}.title`)}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t(`tools.${key}.description`)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-foreground/5">
                    <div className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-3">
                      {t(`tools.${key}.featuresLabel`)}
                    </div>
                    <ul className="space-y-2">
                      {t
                        .raw(`tools.${key}.features`)
                        .map((feature: string, idx: number) => (
                          <li key={idx} className="flex gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                            <span className="text-xs text-muted-foreground leading-relaxed">
                              {feature}
                            </span>
                          </li>
                        ))}
                      <div className="flex lg:justify-start justify-center lg:w-fit w-full">
                        <Button
                          onClick={() => handleCta(key)}
                          className="mt-6 mx-auto w-fit hover:cursor-pointer relative btn-glow inline-flex items-center justify-center gap-2 px-10 py-6 rounded-lg text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all group"
                        >
                          {t("cta")}
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </ul>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
};
