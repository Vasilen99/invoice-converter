'use client'

import { useTranslations } from "next-intl";
import {
  ClipboardX,
  AlertTriangle,
  Scale,
  Clock,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "../motion";
const problemIcons = {
  manual: ClipboardX,
  errors: AlertTriangle,
  compliance: Scale,
  time: Clock,
};
const problemKeys = ["manual", "errors", "compliance", "time"] as const;

export const Problem = () => {
  const t = useTranslations("problem");
  return (
    <section className="relative py-18 px-4">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("subtitle")}
          </p>
        </FadeIn>

        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {problemKeys.map((key) => {
            const Icon = problemIcons[key];
            return (
              <StaggerItem key={key}>
                <div className="glass rounded-2xl p-6 h-full flex flex-col gap-3 group hover:bg-accent/40 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-destructive" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t(`cards.${key}.title`)}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(`cards.${key}.desc`)}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
};
