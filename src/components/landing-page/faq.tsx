"use client";

import { useTranslations } from "next-intl";
import { Stagger, StaggerItem } from "../motion";
import { HeadingSection } from "../HeadingSection";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/animate-ui/components/radix/accordion";
import type React from "react";
import {
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

  return (
    <section id="faq" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <HeadingSection
          title={t("title")}
          subtitle={t("subtitle")}
          type="landing-section"
        />

        {/* FAQ Items */}
        <Stagger>
          <Accordion
            type="single"
            collapsible
            defaultValue="conversion-process"
            className="space-y-3"
          >
            {faqItems.map((item) => (
              <StaggerItem key={item.id}>
                <AccordionItem
                  value={item.id}
                  className="group glass rounded-2xl overflow-hidden border-0"
                >
                  <AccordionTrigger
                    showArrow={true}
                    className="px-6 py-5 flex items-start gap-4 hover:bg-accent/30 transition-colors text-left"
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform text-foreground/70">
                      {item.icon}
                    </div>

                    {/* Question Text */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                        {t(item.titleKey)}
                      </h3>
                    </div>
                  </AccordionTrigger>

                  {/* Answer Content */}
                  <AccordionContent className="px-6 py-5 bg-background/40 border-t border-border">
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {t(item.descKey)}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </StaggerItem>
            ))}
          </Accordion>
        </Stagger>
      </div>
    </section>
  );
}
