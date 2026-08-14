import { useTranslations } from "next-intl";
import { FadeIn, Stagger, StaggerItem } from "../motion";
import { Sparkles, FileText, Wand2, Download } from "lucide-react";

const stepIcons = [FileText, Wand2, Sparkles, Download];
const stepKeys = ["upload", "extract", "generate", "download"] as const;

export const Solution = () => {
  const t = useTranslations("solution");
  return (
    <section id="solution" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("subtitle")}
          </p>
        </FadeIn>

        <Stagger
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          staggerDelay={0.15}
        >
          {stepKeys.map((key, i) => {
            const Icon = stepIcons[i];
            return (
              <StaggerItem key={key}>
                <div className="relative glass rounded-2xl p-6 h-full flex flex-col items-center text-center gap-3 group hover:bg-accent/40 transition-colors">
                  <span className="absolute top-4 right-5 text-4xl font-black text-foreground/5 select-none">
                    {i + 1}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-1 group-hover:bg-accent group-hover:scale-110 transition-all">
                    <Icon className="w-5 h-5 text-foreground/70" />
                  </div>
                  <div className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                    {t(`steps.${key}.label`)}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {t(`steps.${key}.desc`)}
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
