"use client";

import { Zap, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import ThemeToggle from "../ThemeToggle";
import LanguageSwitcher from "../LanguageSwitcher";
import LoginModal from "../LoginModal";

export const Header = () => {
  const t = useTranslations("header");
  const [loginOpen, setLoginOpen] = useState(false);
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border backdrop-blur-xl bg-background/60">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Zap className="w-4 h-4 text-foreground" />
          </div>
          <span className="font-bold text-foreground tracking-tight text-sm">
            Invoice<span className="text-muted-foreground">AI</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-6 text-xs font-medium text-muted-foreground">
          <a href="#hero" className="hover:text-foreground transition-colors">
            {t("home")}
          </a>
          <a
            href="#solution"
            className="hover:text-foreground transition-colors"
          >
            {t("howItWorks")}
          </a>
          <a
            href="#features"
            className="hover:text-foreground transition-colors"
          >
            {t("about")}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {/* <button
            onClick={() => setLoginOpen(true)}
            className="px-4 py-1.5 rounded-full border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors"
          >
            {t("login")}
          </button> */}
          <a
            href="#converter"
            className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors btn-glow"
          >
            {t("cta")}
            <ArrowRight className="w-3 h-3" />
          </a>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
};
