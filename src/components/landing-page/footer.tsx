"use client";

import { Zap, ArrowRight, ShieldCheck, Sparkles, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

export const Footer = () => {
  const t = useTranslations("footer");
  return (
    <footer className="relative border-t border-border">
      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr] mb-12">
          {/* Brand + pitch */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <Zap className="w-4 h-4 text-foreground" />
              </div>
              <span className="font-bold text-foreground tracking-tight text-sm">
                Invoice<span className="text-muted-foreground">AI</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mb-5">
              {t("tagline")}
            </p>
            <a
              href="#converter"
              className="btn-glow inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors group"
            >
              {t("cta")}
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* Quick links */}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">
              {t("linksTitle")}
            </p>
            <nav className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <a href="#hero" className="hover:text-foreground transition-colors">
                {t("links.home")}
              </a>
              <a href="#solution" className="hover:text-foreground transition-colors">
                {t("links.howItWorks")}
              </a>
              <a href="#features" className="hover:text-foreground transition-colors">
                {t("links.features")}
              </a>
              <a href="#converter" className="hover:text-foreground transition-colors">
                {t("links.converter")}
              </a>
            </nav>
          </div>

          {/* Trust signals */}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">
              {t("whyTitle")}
            </p>
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                {t("trust.secure")}
              </li>
              <li className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0" />
                {t("trust.accuracy")}
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 shrink-0" />
                {t("trust.speed")}
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-muted-foreground/50 text-xs">
            © {new Date().getFullYear()} InvoiceAI · {t("rights")}
          </p>
          <p className="text-muted-foreground/50 text-xs">{t("poweredBy")}</p>
        </div>
      </div>
    </footer>
  );
};
