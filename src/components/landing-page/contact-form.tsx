"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { FadeIn } from "../motion";
import { EMAIL_REGEX } from "@/utility/constants";
import { Send, CheckCircle2 } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "@/components/ui/textarea";
import type React from "react";

type FormData = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export function ContactUsForm() {
  const t = useTranslations("contactForm");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({
        ...prev,
        [e.target.name]: e.target.value,
      }));
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitMessage(null);

    // Validation
    if (!formData.name.trim()) {
      setSubmitMessage({
        type: "error",
        text: t("errors.name"),
      });
      setIsLoading(false);
      return;
    }

    if (!formData.email.trim() || !EMAIL_REGEX.test(formData.email.trim())) {
      setSubmitMessage({
        type: "error",
        text: t("errors.email"),
      });
      setIsLoading(false);
      return;
    }

    if (!formData.subject.trim()) {
      setSubmitMessage({
        type: "error",
        text: t("errors.subject"),
      });
      setIsLoading(false);
      return;
    }

    if (!formData.message.trim()) {
      setSubmitMessage({
        type: "error",
        text: t("errors.message"),
      });
      setIsLoading(false);
      return;
    }

    try {
      const formDataObj = new FormData();
      formDataObj.append("name", formData.name);
      formDataObj.append("email", formData.email);
      formDataObj.append("subject", formData.subject);
      formDataObj.append("platform", "InvoiceAI");
      formDataObj.append("message", formData.message);
      formDataObj.append(
        "access_key",
        process.env.NEXT_PUBLIC_WEB_3_ACCESS_KEY || "",
      );

      const object = Object.fromEntries(formDataObj);
      const json = JSON.stringify(object);

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: json,
      });

      const result = await response.json();

      if (result.success) {
        setSubmitMessage({
          type: "success",
          text: t("success"),
        });
        setFormData({
          name: "",
          email: "",
          subject: "",
          message: "",
        });
      } else {
        setSubmitMessage({
          type: "error",
          text: t("errors.submit"),
        });
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setSubmitMessage({
        type: "error",
        text: t("errors.submit"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="contact-us" className="relative py-18 px-4 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <FadeIn className="text-center mb-14">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </FadeIn>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Column - Content */}
          <FadeIn delay={0.1} className="flex flex-col justify-between">
            <div className="space-y-8">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                  {t("content.heading")}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t("content.description")}
                </p>
              </div>

              {/* Info Items */}
              <div className="space-y-6">
                {["email", "response", "available"].map((key) => (
                  <div key={key} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-foreground/70" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {t(`content.info.${key}.title`)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t(`content.info.${key}.desc`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Right Column - Form */}
          <FadeIn delay={0.2} className="glass rounded-2xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Field */}
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="block text-sm font-semibold text-foreground"
                >
                  {t("form.nameLabel")}
                </Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={t("form.namePlaceholder")}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  disabled={isLoading}
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="block text-sm font-semibold text-foreground"
                >
                  {t("form.emailLabel")}
                </Label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder={t("form.emailPlaceholder")}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  disabled={isLoading}
                />
              </div>

              {/* Subject Field */}
              <div className="space-y-2">
                <Label
                  htmlFor="subject"
                  className="block text-sm font-semibold text-foreground"
                >
                  {t("form.subjectLabel")}
                </Label>
                <Input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder={t("form.subjectPlaceholder")}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  disabled={isLoading}
                />
              </div>

              {/* Message Field */}
              <div className="space-y-2">
                <Label
                  htmlFor="message"
                  className="block text-sm font-semibold text-foreground"
                >
                  {t("form.messageLabel")}
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder={t("form.messagePlaceholder")}
                  className="w-full px-4 py-3 min-h-25 max-h-30 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                  disabled={isLoading}
                />
              </div>

              {/* Message Alert */}
              {submitMessage && (
                <div
                  className={`p-4 rounded-lg text-sm font-medium ${
                    submitMessage.type === "success"
                      ? "bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
                  }`}
                >
                  {submitMessage.text}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    {t("form.sending")}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("form.submit")}
                  </>
                )}
              </button>
            </form>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
