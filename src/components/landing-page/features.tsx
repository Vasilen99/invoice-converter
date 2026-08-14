import { useTranslations } from "next-intl";
import { FadeIn, Stagger, StaggerItem } from "../motion";

import {
  BrainCircuit,
  ShieldCheck,
  Gauge,
  PenLine,
  Lock,
  Globe,
} from "lucide-react";

const featureIcons = {
  ai: BrainCircuit,
  compliance: ShieldCheck,
  speed: Gauge,
  edit: PenLine,
  secure: Lock,
  free: Globe,
};

const featureKeys = [
  "ai",
  "compliance",
  "speed",
  "edit",
  "secure",
  "free",
] as const;

export const Features = () => {
  const t = useTranslations("features");
  return (
    <section id="features" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
        </FadeIn>

        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureKeys.map((key) => {
            const Icon = featureIcons[key];
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
      </div>
    </section>
  );
};
