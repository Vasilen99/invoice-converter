"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FadeIn, Stagger, StaggerItem } from "../motion";
import type React from "react";
import {
  ChevronDown,
  Zap,
  CreditCard,
  BarChart3,
  Clock,
  MessageSquareIcon,
  Coins,
} from "lucide-react";

interface FAQItem {
  id: string;
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
}

const faqItems: FAQItem[] = [
  {
    id: "conversion-process",
    icon: <Zap className="w-5 h-5" />,
    titleKey: "items.conversionProcess.title",
    descKey: "items.conversionProcess.desc",
  },
  {
    id: "chat-process",
    icon: <MessageSquareIcon className="w-5 h-5" />,
    titleKey: "items.chatProcess.title",
    descKey: "items.chatProcess.desc",
  },
  {
    id: "compliance-vat",
    icon: <BarChart3 className="w-5 h-5" />,
    titleKey: "items.complianceVat.title",
    descKey: "items.complianceVat.desc",
  },
  {
    id: "credit-system",
    icon: <CreditCard className="w-5 h-5" />,
    titleKey: "items.creditSystem.title",
    descKey: "items.creditSystem.desc",
  },
  {
    id: "credits-usage",
    icon: <Coins className="w-5 h-5" />,
    titleKey: "items.creditsUsage.title",
    descKey: "items.creditsUsage.desc",
  },
  {
    id: "invoice-limits",
    icon: <Clock className="w-5 h-5" />,
    titleKey: "items.invoiceLimits.title",
    descKey: "items.invoiceLimits.desc",
  },
];

export default function FAQLanding() {
  const t = useTranslations("faq");
  const [openId, setOpenId] = useState<string | null>("conversion-process");

  return (
    <section id="faq" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <FadeIn className="text-center mb-14">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </FadeIn>

        {/* FAQ Items */}
        <Stagger className="space-y-3">
          {faqItems.map((item) => (
            <StaggerItem key={item.id}>
              <div
                className="group glass rounded-2xl overflow-hidden transition-all duration-300"
                onClick={() => setOpenId(openId === item.id ? null : item.id)}
              >
                {/* Question Header */}
                <button
                  className="w-full px-6 py-5 flex items-start gap-4 hover:bg-accent/30 transition-colors text-left"
                  aria-expanded={openId === item.id}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform mt-0.5 text-foreground/70">
                    {item.icon}
                  </div>

                  {/* Question Text */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                      {t(item.titleKey)}
                    </h3>
                  </div>

                  {/* Chevron Icon */}
                  <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                    <ChevronDown
                      className={`w-5 h-5 text-foreground/50 transition-transform duration-300 ${
                        openId === item.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Answer Content */}
                {openId === item.id && (
                  <div className="border-t border-border px-6 py-5 bg-background/40">
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {t(item.descKey)}
                    </p>
                  </div>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
