"use client";

import React, { useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { BulgarianInvoiceData } from "../types";
import { HeadingSection } from "./HeadingSection";
import { callApi } from "../../utility/hooks/apiFetch";
import { useGlobalStore } from "@/store/global";
import { useUserStore } from "@/store/user";
import dynamic from "next/dynamic";
import { CREDIT_COSTS, AI_STEP_KEYS } from "@/utility/constants";
import { normalizeBulstat } from "@/utility/helpers/common";
import {
  calculateCreditsNeeded,
  formatInvoiceSequence,
  parseInvoiceSequence,
} from "@/utility/helpers/common";

const SuccessGenerationModal = dynamic(
  () => import("./SuccessModal").then((mod) => mod.SuccessGenerationModal),
  {
    ssr: false,
  },
);
const InvoicesLayoutSection = dynamic(
  () =>
    import("./InvoicesLayoutSection").then((mod) => mod.InvoicesLayoutSection),
  {
    ssr: false,
  },
);

const UploadZone = dynamic(
  () => import("./UploadZone").then((mod) => mod.UploadZone),
  {
    ssr: false,
  },
);
const InvoicePreviewModal = dynamic(
  () =>
    import("@/components/InvoicePreviewModal").then(
      (mod) => mod.InvoicePreviewModal,
    ),
  {
    ssr: false,
  },
);

type InvoiceFile = {
  file: File;
  id: string;
  status: "extracting" | "extracted" | "error";
  data?: BulgarianInvoiceData | null;
  error?: string;
  sourceDocumentUrl?: string | null;
};

type InvoiceUploaderProps = {
  account?: {
    id: number;
    creditBalance: number;
    composer_name?: string | null;
    inv_template?: string | null;
  } | null;
};

const InvoiceUploader = ({ account = null }: InvoiceUploaderProps) => {
  const t = useTranslations("uploader");
  const inputRef = useRef<HTMLInputElement>(null);
  const [invoices, setInvoices] = useState<InvoiceFile[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [previewInvoiceData, setPreviewInvoiceData] =
    useState<BulgarianInvoiceData | null>(null);
  const { setAlertStatus } = useGlobalStore();
  const { user, setUser } = useUserStore();
  const accountComposerName = account?.composer_name || "";
  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId);

  const notifyAlert = (
    status: "error" | "success" | "warning" | "info",
    headerKey: string,
    messageKey: string,
    values?: Record<string, string | number>,
  ) => {
    setAlertStatus({
      status,
      statusHeader: t(headerKey),
      statusContent: t(messageKey, values),
    });
  };

  const cycleAiStep = () => {
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % AI_STEP_KEYS.length;
      setAiStep(i);
    }, 1800);
    return id;
  };

  const saveDocument = async (
    file: File,
    bulstat?: string,
    vatNumber?: string,
    documentType: "source" | "generated" = "source",
  ): Promise<string | null> => {
    try {
      if (!account?.id) {
        notifyAlert(
          "warning",
          "alerts.accountRequiredHeader",
          "alerts.accountRequiredMessage",
        );
        return null;
      }

      const vatNumberWithoutPrefix = vatNumber
        ?.replace(/^BG/, "")
        .replace(/^EU/, "")
        .trim();
      const finalBulstat = bulstat || vatNumberWithoutPrefix || "unknown";

      // Prepare form data for API request
      const formData = new FormData();
      formData.append("file", file);

      // Call the unified upload endpoint
      const response = await fetch(
        `/api/upload-document?bulstat=${encodeURIComponent(finalBulstat)}&documentType=${documentType}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        notifyAlert(
          "warning",
          "alerts.documentUploadFailedHeader",
          "alerts.documentUploadFailedMessage",
        );
        return null;
      }

      const payload = (await response.json()) as {
        data?: { publicUrl?: string | null };
      };
      return payload.data?.publicUrl ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      notifyAlert(
        "warning",
        "alerts.documentUploadFailedHeader",
        "alerts.documentUploadFailedMessage",
        message ? { message } : undefined,
      );
      return null;
    }
  };

  const processFile = async (
    file: File,
    invoiceId: string,
  ): Promise<BulgarianInvoiceData | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await callApi(
        "/extract-invoice",
        {
          method: "POST",
          body: formData,
        },
        true,
      );

      // Check if data is null or invalid
      if (!data) {
        throw new Error(t("extractFailedGeneric"));
      }

      // Extract the data and creditsRemaining from the response
      const creditsRemaining = data.creditsRemaining;

      // Update user store with new credit balance if available
      if (typeof creditsRemaining === "number" && user) {
        setUser({
          ...user,
          creditBalance: creditsRemaining,
        });
      }

      // Save source document to Supabase (non-blocking, fire-and-forget)
      if (data) {
        try {
          const sourceDocUrl = await saveDocument(
            file,
            data.sellerEik,
            data.sellerVatNumber,
            "source",
          );
          if (sourceDocUrl) {
            // Update invoice with the source document URL after upload completes
            setInvoices((prev) =>
              prev.map((inv) =>
                inv.id === invoiceId
                  ? { ...inv, sourceDocumentUrl: sourceDocUrl }
                  : inv,
              ),
            );
          }
        } catch (err) {
          console.log(
            "There was an error while saving the source document:",
            err,
          );

          notifyAlert(
            "warning",
            "alerts.sourceDocumentSaveFailedHeader",
            "alerts.sourceDocumentSaveFailedMessage",
          );
        }
      }

      return data;
    } catch (err: unknown) {
      console.log("failing, loading catch");

      throw err instanceof Error ? err : new Error(t("extractFailedGeneric"));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    if (account) {
      if (
        !calculateCreditsNeeded(
          CREDIT_COSTS.INVOICE_EXTRACTION,
          account.creditBalance,
          Array.from(selectedFiles),
        )
      ) {
        notifyAlert(
          "error",
          "alerts.insufficientCreditsHeader",
          "alerts.insufficientCreditsMessage",
        );
        return;
      }
    }

    const newInvoices: InvoiceFile[] = [];
    const filePromises: Promise<void>[] = [];
    // Add all files to the list with pending status
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      if (file.type !== "application/pdf") {
        setErrorMsg(t("invalidPdf"));
        continue;
      }

      const id = `${Date.now()}-${i}`;
      newInvoices.push({
        file,
        id,
        status: "extracting",
      });

      filePromises.push(
        (async () => {
          const stepTimer = cycleAiStep();
          try {
            const data = await processFile(file, id);

            // Update with extracted data
            setInvoices((prev) =>
              prev.map((inv) => {
                if (inv.id !== id) {
                  return inv;
                }

                if (!data) {
                  return {
                    ...inv,
                    status: "extracted",
                    data,
                    sourceDocumentUrl: null,
                  };
                }

                const sellerEik = normalizeBulstat(data.sellerEik);
                const dbCurrentSequence = parseInvoiceSequence(
                  data.invoiceNumber,
                );

                let nextInvoiceSequence = dbCurrentSequence;
                if (sellerEik) {
                  const maxExistingSequence = prev.reduce((max, current) => {
                    if (current.id === id || !current.data) {
                      return max;
                    }

                    return normalizeBulstat(current.data.sellerEik) ===
                      sellerEik
                      ? Math.max(
                          max,
                          parseInvoiceSequence(current.data.invoiceNumber),
                        )
                      : max;
                  }, 0);

                  nextInvoiceSequence = Math.max(
                    dbCurrentSequence,
                    maxExistingSequence,
                  );
                }

                const preparedData = {
                  ...data,
                  invoiceNumber: formatInvoiceSequence(nextInvoiceSequence + 1),
                };

                return {
                  ...inv,
                  status: "extracted",
                  data: preparedData,
                  sourceDocumentUrl:
                    (
                      preparedData as BulgarianInvoiceData & {
                        sourceDocumentUrl?: string | null;
                      }
                    )?.sourceDocumentUrl || null,
                };
              }),
            );

            // Auto-select first successfully extracted invoice
            setSelectedInvoiceId((prev) => prev || id);
          } catch (_err: unknown) {
            const error =
              _err instanceof Error ? _err.message : t("extractFailed");
            setInvoices((prev) =>
              prev.map((inv) =>
                inv.id === id ? { ...inv, status: "error", error } : inv,
              ),
            );
            setErrorMsg(error);
          } finally {
            clearInterval(stepTimer);
          }
        })(),
      );
    }

    setErrorMsg("");
    setInvoices((prev) => [...prev, ...newInvoices]);
    setAiStep(0);

    await Promise.allSettled(filePromises);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      const fake = {
        target: { files: droppedFiles },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fake);
    }
  };

  const reset = () => {
    setInvoices([]);
    setSelectedInvoiceId(null);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeInvoice = (id: string) => {
    setInvoices((prev) => {
      const updated = prev.filter((inv) => inv.id !== id);

      // Update selected invoice if the deleted one was selected
      if (selectedInvoiceId === id) {
        setSelectedInvoiceId(updated.length > 0 ? updated[0].id : null);
      }

      return updated;
    });
  };

  const updateInvoiceData = (id: string, data: BulgarianInvoiceData) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, data } : inv)),
    );
  };

  const generateAndDownloadPdfs = async (
    invoiceDataList: {
      data: BulgarianInvoiceData;
      filename: string;
      sourceDocumentUrl?: string | null;
    }[],
    isBulk: boolean = false,
  ) => {
    const setLoading = isBulk ? setDownloadingAll : setDownloading;
    setLoading(true);
    try {
      const invalidInvoice = invoiceDataList.find(({ data }) => {
        const sellerEik = normalizeBulstat(data.sellerEik);
        const buyerEik = normalizeBulstat(data.buyerEik);
        return !sellerEik || !buyerEik;
      });

      if (invalidInvoice) {
        notifyAlert(
          "error",
          "alerts.requiredEikHeader",
          "alerts.requiredEikMessage",
          { filename: invalidInvoice.filename },
        );
        return;
      }

      for (const {
        data: invoiceData,
        filename,
        sourceDocumentUrl,
      } of invoiceDataList) {
        // Ensure composer_name is always present in the data sent to the API
        const dataToSend = {
          ...invoiceData,
          invoiceNumber: invoiceData.invoiceNumber || formatInvoiceSequence(1),
          composer_name: invoiceData.composer_name || accountComposerName || "",
          // Include the account's saved template if available
          templateHtml: account?.inv_template || undefined,
        };

        const finalInvoiceNumber = String(dataToSend.invoiceNumber);

        const res = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSend),
        });

        if (!res.ok) throw new Error("PDF generation failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `фактура-${finalInvoiceNumber ?? "generated"}-${dataToSend.sellerEik}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        // Save generated document to Supabase and get the public URL
        const generatedFileName = `фактура-${finalInvoiceNumber ?? "generated"}-${dataToSend.sellerEik}.pdf`;
        const generatedFile = new File([blob], generatedFileName, {
          type: "application/pdf",
        });

        let generatedPdfUrl: string | null = null;
        try {
          generatedPdfUrl = await saveDocument(
            generatedFile,
            invoiceData.sellerEik,
            invoiceData.sellerVatNumber,
            "generated",
          );
        } catch (_err: unknown) {
          notifyAlert(
            "warning",
            "alerts.generatedDocumentSaveFailedHeader",
            "alerts.generatedDocumentSaveFailedMessage",
          );
        }

        // Record the invoice in the database with the generated PDF URL
        try {
          const recordResponse = await callApi(
            "/record-invoice",
            {
              method: "POST",
              body: JSON.stringify({
                invoiceData: dataToSend,
                originalFilename: filename,
                sourceDocumentUrl: sourceDocumentUrl || null,
                generatedPdfUrl: generatedPdfUrl || null,
                creditsCost: CREDIT_COSTS.INVOICE_EXTRACTION,
              }),
            },
            true,
          );

          if (!recordResponse) {
            notifyAlert(
              "warning",
              "alerts.recordInvoiceFailedHeader",
              "alerts.recordInvoiceFailedMessage",
            );
          }
        } catch {
          notifyAlert(
            "warning",
            "alerts.recordInvoiceFailedHeader",
            "alerts.recordInvoiceFailedMessage",
          );
        }

        // Add a small delay between downloads to avoid issues (only for bulk)
        if (isBulk) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      setSuccessModalOpen(true);
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : t("extractFailed");
      setErrorMsg(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (
    invoiceData: BulgarianInvoiceData,
    originalFilename?: string,
    sourceDocumentUrl?: string | null,
  ) => {
    await generateAndDownloadPdfs(
      [
        {
          data: invoiceData,
          filename: originalFilename ?? "invoice.pdf",
          sourceDocumentUrl: sourceDocumentUrl || null,
        },
      ],
      false,
    );
  };

  const handleDownloadAll = async () => {
    const validInvoices = invoices
      .filter((inv) => inv.data)
      .map((inv) => ({
        data: inv.data!,
        filename: inv.file.name,
        sourceDocumentUrl: inv.sourceDocumentUrl || null,
      }));
    await generateAndDownloadPdfs(validInvoices, true);
  };

  return (
    <div className="w-full">
      <HeadingSection title={t("title")} subtitle={t("subtitle")} />
      {/* ── UPLOAD ZONE ── */}
      {invoices.length === 0 && (
        <UploadZone
          dragOver={dragOver}
          inputRef={inputRef}
          handleDrop={handleDrop}
          t={t}
          setDragOver={setDragOver}
        />
      )}

      {/* Hidden file input - always available */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
        multiple
      />

      {/* ── ERROR ── */}
      {errorMsg && (
        <div className="my-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-start gap-3 animate-fade-up">
          <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              {t("somethingWrong")}
            </p>
            <p className="text-xs text-destructive/80 mt-0.5">{errorMsg}</p>
          </div>
          <button
            onClick={reset}
            className="text-xs text-destructive/70 hover:text-destructive underline"
          >
            {t("close")}
          </button>
        </div>
      )}

      {/* ── FILES LOADED ── */}
      {invoices.length > 0 && (
        <InvoicesLayoutSection
          invoices={invoices}
          selectedInvoiceId={selectedInvoiceId}
          selectedInvoice={selectedInvoice}
          downloading={downloading}
          downloadingAll={downloadingAll}
          accountComposerName={accountComposerName}
          aiStep={aiStep}
          t={t}
          setSelectedInvoiceId={setSelectedInvoiceId}
          removeInvoice={removeInvoice}
          updateInvoiceData={updateInvoiceData}
          handleDownload={handleDownload}
          handleDownloadAll={handleDownloadAll}
          onPreview={setPreviewInvoiceData}
          inputRef={inputRef}
          reset={reset}
        />
      )}

      <SuccessGenerationModal
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        t={t}
      />

      <InvoicePreviewModal
        isOpen={Boolean(previewInvoiceData)}
        onClose={() => setPreviewInvoiceData(null)}
        invoiceData={previewInvoiceData}
        templateHtml={account?.inv_template ?? null}
      />
    </div>
  );
};

export default InvoiceUploader;
