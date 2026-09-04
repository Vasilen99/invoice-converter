"use client";

import React, { useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { BulgarianInvoiceData } from "../types";
import { HeadingSection } from "./HeadingSection";
import { callApi } from "../../utility/hooks/apiFetch";
import { useGlobalStore } from "@/store/global";
import dynamic from "next/dynamic";
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

type InvoiceFile = {
  file: File;
  id: string;
  status: "extracting" | "extracted" | "error";
  data?: BulgarianInvoiceData | null;
  error?: string;
  sourceDocumentUrl?: string | null;
};

type MissingOrganizationByEik = {
  bulstat: string;
};

type MissingContragentByEik = {
  bulstat: string;
  organizationId: number | null;
  organizationBulstat: string;
  organizationName: string | null;
};

type InvoicePartyPair = {
  sellerEik: string;
  buyerEik: string;
};

type InvoiceUploaderProps = {
  account?: {
    id: number;
    creditBalance: number;
    composer_name?: string | null;
  } | null;
};

const AI_STEP_KEYS = ["step1", "step2", "step3", "step4", "step5"] as const;

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
  const [missingOrganizations, setMissingOrganizations] = useState<
    MissingOrganizationByEik[]
  >([]);
  const [missingContragents, setMissingContragents] = useState<
    MissingContragentByEik[]
  >([]);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const { setAlertStatus } = useGlobalStore();
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

  const normalizeEik = (value: string | undefined): string =>
    (value ?? "").trim();

  const parseInvoiceSequence = (value: unknown): number => {
    if (value === null || value === undefined) {
      return 0;
    }

    const digits = String(value).replace(/\D/g, "");
    if (!digits) {
      return 0;
    }

    const parsed = parseInt(digits, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatInvoiceSequence = (sequence: number): string => {
    const safeSequence = Number.isFinite(sequence) ? Math.max(0, sequence) : 0;
    return String(safeSequence).padStart(10, "0");
  };

  const checkMissingEntities = async (
    organizationEiks: string[],
    invoicePairs: InvoicePartyPair[],
  ) => {
    const uniqueEiks = [
      ...new Set(organizationEiks.map((eik) => normalizeEik(eik))),
    ].filter(Boolean);

    const uniqueInvoicePairs = Array.from(
      new Map(
        invoicePairs
          .map((pair) => ({
            sellerEik: normalizeEik(pair.sellerEik),
            buyerEik: normalizeEik(pair.buyerEik),
          }))
          .filter((pair) => pair.sellerEik && pair.buyerEik)
          .map((pair) => [`${pair.sellerEik}::${pair.buyerEik}`, pair]),
      ).values(),
    );

    if (uniqueEiks.length === 0 && uniqueInvoicePairs.length === 0) {
      return;
    }

    const result = await callApi(
      "/organizations/missing-from-invoices",
      {
        method: "POST",
        body: JSON.stringify({
          eiks: uniqueEiks,
          invoicePairs: uniqueInvoicePairs,
        }),
      },
      false,
    );

    const organizations = result?.missingOrganizations ?? [];
    const contragents = result?.missingContragents ?? [];

    setMissingOrganizations((prev) => {
      const deduped = new Map<string, MissingOrganizationByEik>();
      for (const org of [...prev, ...organizations]) {
        deduped.set(normalizeEik(org.bulstat), org);
      }

      return Array.from(deduped.values());
    });

    setMissingContragents((prev) => {
      const deduped = new Map<string, MissingContragentByEik>();
      for (const contragent of [...prev, ...contragents]) {
        const key = `${normalizeEik(contragent.bulstat)}::${normalizeEik(contragent.organizationBulstat)}`;
        deduped.set(key, contragent);
      }

      return Array.from(deduped.values());
    });
  };

  const handleGenerationSuccess = async (generatedSellerEiks: Set<string>) => {
    // Only remove organizations that were just generated
    setMissingOrganizations((prev) =>
      prev.filter((org) => !generatedSellerEiks.has(normalizeEik(org.bulstat))),
    );

    // Only remove contragents that were just generated
    // A contragent is "generated" if its seller org was generated
    setMissingContragents((prev) =>
      prev.filter(
        (contragent) =>
          !generatedSellerEiks.has(
            normalizeEik(contragent.organizationBulstat),
          ),
      ),
    );

    setSuccessModalOpen(true);
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

      const accountId = account.id;
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
        `/api/upload-document?accountId=${accountId}&bulstat=${encodeURIComponent(finalBulstat)}&documentType=${documentType}`,
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

      const { publicUrl } = await response.json();
      return publicUrl;
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

      // Save source document to Supabase (non-blocking, fire-and-forget)
      if (data) {
        saveDocument(file, data.sellerEik, data.sellerVatNumber, "source")
          .then((sourceDocUrl: string | null) => {
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
          })
          .catch(() => {
            notifyAlert(
              "warning",
              "alerts.sourceDocumentSaveFailedHeader",
              "alerts.sourceDocumentSaveFailedMessage",
            );
          });
      }

      return data;
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error(t("extractFailed"));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newInvoices: InvoiceFile[] = [];
    const filePromises: Promise<void>[] = [];
    const extractedOrganizationEiks = new Set<string>();
    const extractedInvoicePairs = new Map<string, InvoicePartyPair>();

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

            if (data) {
              const sellerEik = normalizeEik(data.sellerEik);
              const buyerEik = normalizeEik(data.buyerEik);
              if (sellerEik) extractedOrganizationEiks.add(sellerEik);
              if (sellerEik && buyerEik) {
                extractedInvoicePairs.set(`${sellerEik}::${buyerEik}`, {
                  sellerEik,
                  buyerEik,
                });
              }
            }

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

                const sellerEik = normalizeEik(data.sellerEik);
                const dbCurrentSequence = parseInvoiceSequence(
                  data.invoiceNumber,
                );

                let nextInvoiceSequence = dbCurrentSequence;
                if (sellerEik) {
                  const maxExistingSequence = prev.reduce((max, current) => {
                    if (current.id === id || !current.data) {
                      return max;
                    }

                    return normalizeEik(current.data.sellerEik) === sellerEik
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
                    (preparedData as any)?.sourceDocumentUrl || null,
                };
              }),
            );

            // Auto-select first successfully extracted invoice
            setSelectedInvoiceId((prev) => prev || id);
          } catch (err: unknown) {
            const error =
              err instanceof Error ? err.message : t("extractFailed");
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
    await checkMissingEntities(
      [...extractedOrganizationEiks],
      Array.from(extractedInvoicePairs.values()),
    );
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
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    if (selectedInvoiceId === id) {
      const remaining = invoices.filter((inv) => inv.id !== id);
      setSelectedInvoiceId(remaining.length > 0 ? remaining[0].id : null);
    }
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
        const sellerEik = normalizeEik(data.sellerEik);
        const buyerEik = normalizeEik(data.buyerEik);
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

      // Collect all seller/buyer EIKs from invoices being generated
      // so we can remove only those from missingOrganizations/Contragents
      const generatedSellerEiks = new Set<string>();

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

        // Save generated document to Supabase (non-blocking, fire-and-forget)
        const generatedFileName = `фактура-${finalInvoiceNumber ?? "generated"}-${dataToSend.sellerEik}.pdf`;
        const generatedFile = new File([blob], generatedFileName, {
          type: "application/pdf",
        });

        saveDocument(
          generatedFile,
          invoiceData.sellerEik,
          invoiceData.sellerVatNumber,
          "generated",
        ).catch(() => {
          notifyAlert(
            "warning",
            "alerts.generatedDocumentSaveFailedHeader",
            "alerts.generatedDocumentSaveFailedMessage",
          );
        });

        // Record the invoice in the database (fire-and-forget, non-blocking)
        callApi(
          "/record-invoice",
          {
            method: "POST",
            body: JSON.stringify({
              invoiceData: dataToSend,
              originalFilename: filename,
              sourceDocumentUrl: sourceDocumentUrl || null,
            }),
          },
          true,
        ).catch(() => {
          notifyAlert(
            "warning",
            "alerts.recordInvoiceFailedHeader",
            "alerts.recordInvoiceFailedMessage",
          );
        });

        // Track which sellers/buyers were generated in this batch
        const sellerEik = normalizeEik(invoiceData.sellerEik);
        if (sellerEik) generatedSellerEiks.add(sellerEik);

        // Add a small delay between downloads to avoid issues (only for bulk)
        if (isBulk) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // Only remove organizations/contragents that were just generated
      handleGenerationSuccess(generatedSellerEiks);
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
  ) => {
    await generateAndDownloadPdfs(
      [{ data: invoiceData, filename: originalFilename ?? "invoice.pdf" }],
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
        <div className="mt-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-start gap-3 animate-fade-up">
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
          inputRef={inputRef}
          reset={reset}
        />
      )}

      <SuccessGenerationModal
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        t={t}
      />
    </div>
  );
};

export default InvoiceUploader;
