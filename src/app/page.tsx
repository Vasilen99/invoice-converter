"use client";

import { Sparkles, ArrowRight, ArrowDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { FadeIn } from "../components/motion";
// import { Converter } from "@/components/landing-page/converter";
import { FinalCta } from "@/components/landing-page/final-cta";
import { Features } from "@/components/landing-page/features";
import { Solution } from "@/components/landing-page/solution";
import { Problem } from "@/components/landing-page/problem";
import { Header } from "@/components/landing-page/header";
import { Footer } from "@/components/landing-page/footer";

/* ─────────────────────────── Hero ─────────────────────────── */

const PROVIDERS = [
  "Stripe",
  "PayPal",
  "Wix",
  "Google",
  "Shopify",
  "Upwork",
  "GoDaddy",
  "Meta",
];

const Hero = () => {
  const t = useTranslations("hero");
  return (
    <section id="hero" className="relative pt-36 pb-24 px-4">
      <div className="max-w-5xl mx-auto text-center">
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            {t("badge")}
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-foreground leading-[1.05] mb-6">
            {t("titleStart")}
            <br />
            <span className="gradient-text">{t("titleHighlight")}</span>
            <br />
            {t("titleEnd")}
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            {t("subtitle")}
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="#converter"
              className="btn-glow group flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all"
            >
              {t("ctaPrimary")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#solution"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-foreground glass hover:bg-accent/50 transition-colors"
            >
              {t("ctaSecondary")}
              <ArrowDown className="w-4 h-4" />
            </a>
          </div>
        </FadeIn>

        {/* Provider marquee */}
        <FadeIn delay={0.4}>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.2em] mb-5">
            {t("trustedBy")}
          </p>
          <div className="relative overflow-hidden marquee-mask">
            <div className="animate-marquee flex items-center gap-12 w-max">
              {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
                <span
                  key={i}
                  className="text-xl font-black tracking-tight text-foreground/25 hover:text-foreground/60 transition-colors select-none"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
};

/* ─────────────────────────── Page ─────────────────────────── */

const HomePage = () => {
  return (
    <>
      <Header />
      <main className="relative min-h-screen overflow-x-hidden bg-background">
        {/* ── Animated gradient background ── */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="animate-float absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-foreground/[0.06] blur-[120px]" />
          <div className="animate-float2 absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-foreground/[0.05] blur-[100px]" />
          <div className="animate-float absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-foreground/[0.04] blur-[90px]" />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(currentColor 1px,transparent 1px),linear-gradient(90deg,currentColor 1px,transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative z-10">
          <Hero />
          <Problem />
          <Solution />
          <Features />
          <FinalCta />
          {/* <Converter /> */}
          <Footer />
        </div>
      </main>
    </>
  );
};

export default HomePage;
