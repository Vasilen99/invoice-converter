"use client";

import React from "react";
import {
  Upload,
  X,
  Loader2,
  AlertCircle,
  Download,
  FileOutput,
  CheckCircle2,
  Sparkles,
  Wand2,
} from "lucide-react";
import PdfViewer from "./PdfViewer";
import { BulgarianInvoiceData } from "../types";

type InvoiceFile = {
  file: File;
  id: string;
  status: "extracting" | "extracted" | "error";
  data?: BulgarianInvoiceData | null;
  error?: string;
};

const AI_STEP_KEYS = ["step1", "step2", "step3", "step4", "step5"] as const;

const EditField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  required?: boolean;
}> = ({ label, value, onChange, className = "", required = false }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
      {label}
      {required ? " *" : ""}
    </label>
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm text-foreground bg-background border border-input rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-all"
    />
  </div>
);

const EditSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-foreground/70 uppercase tracking-widest">
        {title}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
    {children}
  </div>
);

interface InvoicesLayoutSectionProps {
  invoices: InvoiceFile[];
  selectedInvoiceId: string | null;
  selectedInvoice: InvoiceFile | undefined;
  downloading: boolean;
  downloadingAll: boolean;
  accountComposerName: string;
  aiStep: number;
  t: (key: string, options?: Record<string, string | number>) => string;
  setSelectedInvoiceId: (id: string | null) => void;
  removeInvoice: (id: string) => void;
  updateInvoiceData: (id: string, data: BulgarianInvoiceData) => void;
  handleDownload: (
    invoiceData: BulgarianInvoiceData,
    originalFilename?: string,
  ) => Promise<void>;
  handleDownloadAll: () => Promise<void>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  reset: () => void;
}

export const InvoicesLayoutSection = ({
  invoices,
  selectedInvoiceId,
  selectedInvoice,
  downloading,
  downloadingAll,
  accountComposerName,
  aiStep,
  t,
  setSelectedInvoiceId,
  removeInvoice,
  updateInvoiceData,
  handleDownload,
  handleDownloadAll,
  inputRef,
  reset,
}: InvoicesLayoutSectionProps) => {
  const allExtracted =
    invoices.length > 0 && invoices.every((inv) => inv.status === "extracted");

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* Top bar with add more and extract all */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-semibold text-foreground lg:flex hidden">
          {t("invoicesCount", { count: invoices.length })} invoices
        </div>
        <div className="flex lg:flex-row flex-col lg:items-center items-start gap-3">
          {allExtracted && (
            <button
              onClick={() => handleDownloadAll()}
              disabled={downloadingAll}
              className="btn-green-glow flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground hover:cursor-pointer
                    bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {downloadingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloadingAll ? t("generating") : t("extractAllInvoices")}
            </button>
          )}
          <button
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = "";
                inputRef.current.click();
              }
            }}
            className="lg:w-fit w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-accent border border-dashed border-border"
          >
            <Upload className="w-3.5 h-3.5" /> {t("addMore")}
          </button>
          <button
            onClick={reset}
            className="flex lg:w-fit w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent"
          >
            <X className="w-3.5 h-3.5" /> {t("removeAll")}
          </button>
        </div>
      </div>
      <div className="text-sm font-semibold text-foreground flex lg:hidden">
        {t("invoicesCount", { count: invoices.length })} invoices
      </div>
      {/* Two-column area: Invoice list + Viewer/Editor */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT — Invoice Cards List */}
        <div className="w-full lg:w-1/3 shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-foreground/50 inline-block" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {t("invoices")}
            </span>
          </div>
          <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => {
                  setSelectedInvoiceId(inv.id);
                }}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer
                      ${
                        selectedInvoiceId === inv.id
                          ? "border-ring bg-accent/30"
                          : "border-border hover:border-ring/50 bg-card"
                      }
                      ${inv.status === "error" ? "border-destructive/50 bg-destructive/5" : ""}
                    `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {inv.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(inv.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === "extracting" && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                    {inv.status === "extracted" && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {inv.status === "error" && (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeInvoice(inv.id);
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors hover:cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {inv.status === "error" && inv.error && (
                  <p className="text-xs text-destructive mt-2">{inv.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE — PDF Viewer */}
        {selectedInvoice?.file && (
          <div
            key={selectedInvoiceId}
            className="w-full lg:w-1/3 shrink-0 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-foreground/50 inline-block" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {t("stripeInvoice")}
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-xl shadow-foreground/5 border border-border">
              <PdfViewer file={selectedInvoice.file} />
            </div>
          </div>
        )}

        {/* RIGHT — Bulgarian invoice editor */}
        <div className="w-full lg:w-1/3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-foreground/70 inline-block" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {t("bulgarianInvoice")}
            </span>
          </div>

          {!selectedInvoice && invoices.length > 0 && (
            <div className="animate-scale-in rounded-2xl overflow-hidden border border-border shadow-lg shadow-foreground/5 bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("selectInvoiceToEdit")}
              </p>
            </div>
          )}

          {selectedInvoice?.status === "extracting" && (
            <div className="animate-scale-in rounded-2xl overflow-hidden border border-border shadow-lg shadow-foreground/5">
              {/* Shimmer header */}
              <div className="animate-shimmer bg-linear-to-r from-primary via-primary/70 to-primary p-4 text-primary-foreground text-center">
                <div className="flex items-center justify-center gap-2 font-bold text-sm tracking-wide">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  {t("aiReading")}
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="bg-card p-8 flex flex-col items-center gap-6">
                {/* Spinning ring */}
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-secondary" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-foreground animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-muted-foreground animate-spin-slow" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Wand2 className="w-6 h-6 text-foreground/60 animate-pulse" />
                  </div>
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
          )}

          {selectedInvoice?.status === "extracted" && selectedInvoice.data && (
            <div className="animate-scale-in rounded-2xl overflow-hidden border border-border shadow-lg shadow-foreground/5">
              {/* Header */}
              <div className="bg-primary p-4 text-primary-foreground">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  {t("dataExtracted")}
                </div>
              </div>

              <div className="bg-card p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
                {/* Section: Фактура */}
                <EditSection title={t("sections.invoice")}>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField
                      label={t("fields.number")}
                      value={selectedInvoice.data.invoiceNumber}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          invoiceNumber: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.date")}
                      value={selectedInvoice.data.invoiceDate}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          invoiceDate: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.taxEventDate")}
                      value={selectedInvoice.data.taxEventDate}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          taxEventDate: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.location")}
                      value={selectedInvoice.data.location}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          location: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.currency")}
                      value={selectedInvoice.data.currency}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          currency: v,
                        })
                      }
                    />
                  </div>
                </EditSection>

                {/* Section: Доставчик */}
                <EditSection title={t("sections.seller")}>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField
                      label={t("fields.name")}
                      value={selectedInvoice.data.sellerName}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          sellerName: v,
                        })
                      }
                      className="col-span-2"
                    />
                    <EditField
                      label={t("fields.eik")}
                      value={selectedInvoice.data.sellerEik}
                      required
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          sellerEik: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.vatNumber")}
                      value={selectedInvoice.data.sellerVatNumber}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          sellerVatNumber: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.city")}
                      value={selectedInvoice.data.sellerCity}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          sellerCity: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.address")}
                      value={selectedInvoice.data.sellerAddress}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          sellerAddress: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.mol")}
                      value={selectedInvoice.data.sellerMol}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          sellerMol: v,
                        })
                      }
                      className="col-span-2"
                    />
                  </div>
                </EditSection>

                {/* Section: Получател */}
                <EditSection title={t("sections.buyer")}>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField
                      label={t("fields.name")}
                      value={selectedInvoice.data.buyerName}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          buyerName: v,
                        })
                      }
                      className="col-span-2"
                    />
                    <EditField
                      label={t("fields.eik")}
                      value={selectedInvoice.data.buyerEik}
                      required
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          buyerEik: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.vatNumber")}
                      value={selectedInvoice.data.buyerVatNumber}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          buyerVatNumber: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.city")}
                      value={selectedInvoice.data.buyerCity}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          buyerCity: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.address")}
                      value={selectedInvoice.data.buyerAddress}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          buyerAddress: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.mol")}
                      value={selectedInvoice.data.buyerMol}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          buyerMol: v,
                        })
                      }
                      className="col-span-2"
                    />
                  </div>
                </EditSection>

                {/* Section: Артикули */}
                <EditSection title={t("sections.items")}>
                  <div className="flex flex-col gap-3">
                    {selectedInvoice.data.lineItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="border border-border rounded-xl p-3 bg-muted/50 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            {t("row", { number: idx + 1 })}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateInvoiceData(selectedInvoiceId!, {
                                ...selectedInvoice.data!,
                                lineItems:
                                  selectedInvoice.data!.lineItems.filter(
                                    (_, i) => i !== idx,
                                  ),
                              })
                            }
                            className="text-xs text-destructive/70 hover:text-destructive flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> {t("remove")}
                          </button>
                        </div>
                        <EditField
                          label={t("fields.description")}
                          value={item.description}
                          onChange={(v) =>
                            updateInvoiceData(selectedInvoiceId!, {
                              ...selectedInvoice.data!,
                              lineItems: selectedInvoice.data!.lineItems.map(
                                (li, i) =>
                                  i === idx ? { ...li, description: v } : li,
                              ),
                            })
                          }
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <EditField
                            label={t("fields.unit")}
                            value={item.unit}
                            onChange={(v) =>
                              updateInvoiceData(selectedInvoiceId!, {
                                ...selectedInvoice.data!,
                                lineItems: selectedInvoice.data!.lineItems.map(
                                  (li, i) =>
                                    i === idx ? { ...li, unit: v } : li,
                                ),
                              })
                            }
                          />
                          <EditField
                            label={t("fields.quantity")}
                            value={item.quantity}
                            onChange={(v) =>
                              updateInvoiceData(selectedInvoiceId!, {
                                ...selectedInvoice.data!,
                                lineItems: selectedInvoice.data!.lineItems.map(
                                  (li, i) =>
                                    i === idx ? { ...li, quantity: v } : li,
                                ),
                              })
                            }
                          />
                          <EditField
                            label={t("fields.unitPrice")}
                            value={item.unitPrice}
                            onChange={(v) =>
                              updateInvoiceData(selectedInvoiceId!, {
                                ...selectedInvoice.data!,
                                lineItems: selectedInvoice.data!.lineItems.map(
                                  (li, i) =>
                                    i === idx ? { ...li, unitPrice: v } : li,
                                ),
                              })
                            }
                          />
                          <EditField
                            label={t("fields.vatPercent")}
                            value={item.vatPercent}
                            onChange={(v) =>
                              updateInvoiceData(selectedInvoiceId!, {
                                ...selectedInvoice.data!,
                                lineItems: selectedInvoice.data!.lineItems.map(
                                  (li, i) =>
                                    i === idx ? { ...li, vatPercent: v } : li,
                                ),
                              })
                            }
                          />
                          <EditField
                            label={t("fields.value")}
                            value={item.value}
                            onChange={(v) =>
                              updateInvoiceData(selectedInvoiceId!, {
                                ...selectedInvoice.data!,
                                lineItems: selectedInvoice.data!.lineItems.map(
                                  (li, i) =>
                                    i === idx ? { ...li, value: v } : li,
                                ),
                              })
                            }
                            className="col-span-2"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          lineItems: [
                            ...selectedInvoice.data!.lineItems,
                            {
                              description: "",
                              unit: "бр.",
                              quantity: "1",
                              unitPrice: "0.00",
                              vatPercent: "20",
                              value: "0.00",
                            },
                          ],
                        })
                      }
                      className="text-xs text-foreground/70 hover:text-foreground border border-dashed border-border rounded-xl py-2 px-4 hover:bg-accent transition-colors"
                    >
                      {t("addRow")}
                    </button>
                  </div>
                </EditSection>

                {/* Section: Суми */}
                <EditSection title={t("sections.totals")}>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField
                      label={t("fields.subtotal")}
                      value={selectedInvoice.data.subtotal}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          subtotal: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.vatAmount")}
                      value={selectedInvoice.data.vatAmount}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          vatAmount: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.total")}
                      value={selectedInvoice.data.total}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          total: v,
                        })
                      }
                      className="col-span-2"
                    />
                    <EditField
                      label={t("fields.totalInWords")}
                      value={selectedInvoice.data.totalInWords}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          totalInWords: v,
                        })
                      }
                      className="col-span-2"
                    />
                  </div>
                </EditSection>

                {/* Section: Payment */}
                <EditSection title={t("sections.payment")}>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField
                      label={t("fields.bank")}
                      value={selectedInvoice.data.bank ?? ""}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          bank: v,
                        })
                      }
                      className="col-span-2"
                    />
                    <EditField
                      label={t("fields.iban")}
                      value={selectedInvoice.data.iban ?? ""}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          iban: v,
                        })
                      }
                    />
                    <EditField
                      label={t("fields.bic")}
                      value={selectedInvoice.data.bic ?? ""}
                      onChange={(v) =>
                        updateInvoiceData(selectedInvoiceId!, {
                          ...selectedInvoice.data!,
                          bic: v,
                        })
                      }
                    />
                  </div>
                </EditSection>

                {/* Section: Composer */}
                <EditSection title={t("sections.composer")}>
                  <EditField
                    label={t("fields.composerName")}
                    value={
                      selectedInvoice.data.composer_name ??
                      accountComposerName ??
                      ""
                    }
                    onChange={(v) =>
                      updateInvoiceData(selectedInvoiceId!, {
                        ...selectedInvoice.data!,
                        composer_name: v,
                      })
                    }
                    className="col-span-2"
                  />
                </EditSection>

                <button
                  onClick={() => {
                    if (selectedInvoice.data) {
                      handleDownload(
                        selectedInvoice.data,
                        selectedInvoice.file.name,
                      );
                    }
                  }}
                  className="btn-glow w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-primary-foreground hover:cursor-pointer
                        bg-primary hover:bg-primary/90"
                >
                  <FileOutput className="w-5 h-5" />
                  {downloading ? t("generating") : t("downloadPdf")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
