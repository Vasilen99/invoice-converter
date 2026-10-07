"use client";

import type React from "react";
import { HeadingSection } from "@/components/HeadingSection";
import NoAccountFallback from "@/components/NoAccountFallback";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { callApi } from "@/utility/hooks/apiFetch";
import {
  getDefaultInvoiceTemplateHtml,
  normalizeTemplateHtml,
} from "@/utility/invoice-template";
import { useGlobalStore } from "@/store/global";
import { useUserStore } from "@/store/user";
import { Loader2, UploadCloud, Wand2 } from "lucide-react";
import { CREDIT_COSTS, AI_STEP_KEYS } from "@/utility/constants";

type InvoiceTemplatePageProps = {
  account: {
    id: number;
    inv_template: string | null;
  } | null;
};

type AnalyzeTemplateResponse = {
  templateHtml: string;
};

export default function InvoiceTemplatePage({
  account,
}: InvoiceTemplatePageProps) {
  const t = useTranslations("invoiceTemplate");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { setAlertStatus } = useGlobalStore();
  const { user } = useUserStore();
  const fallbackTemplate = useMemo(() => getDefaultInvoiceTemplateHtml(), []);
  const [savedTemplate, setSavedTemplate] = useState<string>(
    account?.inv_template || fallbackTemplate,
  );
  const [candidateTemplate, setCandidateTemplate] = useState<string | null>(
    null,
  );
  const [sourceFileName, setSourceFileName] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const normalizedSavedTemplate = useMemo(
    () => normalizeTemplateHtml(savedTemplate) || fallbackTemplate,
    [savedTemplate, fallbackTemplate],
  );

  const normalizedCandidateTemplate = useMemo(() => {
    if (!candidateTemplate) return null;
    return normalizeTemplateHtml(candidateTemplate) || null;
  }, [candidateTemplate]);

  const cycleAiStep = () => {
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % AI_STEP_KEYS.length;
      setAiStep(i);
    }, 1800);
    return id;
  };

  const onAnalyzeFile = async (file: File) => {
    const allowed = [".pdf", ".doc", ".docx"];
    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;

    if (!allowed.includes(extension)) {
      setAlertStatus({
        status: "error",
        statusHeader: t("alerts.unsupportedFileHeader"),
        statusContent: t("alerts.unsupportedFileMessage"),
      });
      return;
    }

    // Check if user has enough credits (3 required for analysis)
    const requiredCredits = CREDIT_COSTS.TEMPLATE_EXTRACTION;
    const userCredits = user?.creditBalance ?? 0;
    if (userCredits < requiredCredits) {
      setAlertStatus({
        status: "error",
        statusHeader: t("alerts.insufficientCreditsHeader"),
        statusContent: t("alerts.insufficientCreditsMessage"),
      });
      return;
    }

    setIsAnalyzing(true);
    setSourceFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const stepTimer = cycleAiStep();

      const result = (await callApi(
        "/invoice-template/analyze",
        {
          method: "POST",
          body: formData,
        },
        true,
      )) as AnalyzeTemplateResponse | null;

      clearInterval(stepTimer);

      if (!result?.templateHtml) {
        return;
      }

      setCandidateTemplate(result.templateHtml);
    } catch (error) {
      console.error("Template analyze failed", error);
    } finally {
      setIsAnalyzing(false);
      setAiStep(0);
    }
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Store reference to input element before async call
    const inputElement = event.currentTarget;

    await onAnalyzeFile(file);

    // Safely reset input value, checking if input still exists
    if (inputElement) {
      inputElement.value = "";
    }
  };

  const onSaveTemplate = async () => {
    if (!candidateTemplate) return;
    setIsSaving(true);
    try {
      const result = (await callApi(
        "/invoice-template/save",
        {
          method: "POST",
          body: JSON.stringify({ template: candidateTemplate }),
        },
        true,
      )) as { id: number; inv_template: string | null } | null;

      if (result?.inv_template) {
        setSavedTemplate(result.inv_template);
        setCandidateTemplate(null);
        setSourceFileName("");
      }
    } catch (error) {
      console.error("Template save failed", error);
    } finally {
      setIsSaving(false);
    }
  };

  const onDiscardTemplate = () => {
    setCandidateTemplate(null);
    setSourceFileName("");
  };

  return !account ? (
    <NoAccountFallback />
  ) : (
    <section className="flex flex-col gap-6">
      <HeadingSection title={t("header")} subtitle={t("subheader")} />

      <div className="rounded-xl border border-border bg-card p-4 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">
              {t("upload.title")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("upload.hint")}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={onFileChange}
            />
            <Button
              disabled={isAnalyzing}
              onClick={() => inputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("upload.analyzing")}
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {t("upload.cta")}
                </>
              )}
            </Button>
          </div>
        </div>

        {sourceFileName ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("upload.selectedFile", { file: sourceFileName })}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 lg:p-5 min-w-0 flex flex-col">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-foreground">
              {t("currentTemplate.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("currentTemplate.description")}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background h-130 overflow-auto overscroll-contain touch-pan-x touch-pan-y">
            <iframe
              title="current-template"
              sandbox="allow-same-origin"
              className="block border-0 max-w-none"
              style={{ width: "794px", height: "1123px", display: "block" }}
              srcDoc={normalizedSavedTemplate}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 lg:p-5 min-w-0 flex flex-col">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t("candidateTemplate.title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("candidateTemplate.description")}
              </p>
            </div>
          </div>

          {isAnalyzing ? (
            <div className="flex h-130 items-center justify-center rounded-lg border border-dashed border-border bg-background p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wand2 className="w-6 h-6 text-foreground/60 animate-pulse" />
                </div>
                <div className="text-center">
                  <p
                    className="text-sm font-semibold text-foreground mb-1 animate-fade-in"
                    key={aiStep}
                  >
                    {t(`aiSteps.${AI_STEP_KEYS[aiStep]}`)}
                  </p>
                  <div className="flex gap-1 justify-center mt-3">
                    {AI_STEP_KEYS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 rounded-full transition-all duration-500 ${i === aiStep ? "w-6 bg-foreground" : "w-2 bg-muted"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : normalizedCandidateTemplate ? (
            <>
              <div className="rounded-lg border border-border bg-background h-130 overflow-auto overscroll-contain touch-pan-x touch-pan-y">
                <iframe
                  title="candidate-template"
                  sandbox="allow-same-origin"
                  className="block border-0 max-w-none"
                  style={{ width: "794px", height: "1123px", display: "block" }}
                  srcDoc={normalizedCandidateTemplate}
                />
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDiscardTemplate}
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  {t("actions.discard")}
                </Button>
                <Button
                  type="button"
                  onClick={onSaveTemplate}
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("actions.saving")}
                    </>
                  ) : (
                    t("actions.save")
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex h-130 items-center justify-center rounded-lg border border-dashed border-border bg-background p-6 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                {t("candidateTemplate.empty")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
