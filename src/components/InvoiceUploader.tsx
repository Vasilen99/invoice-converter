"use client";

import React, { useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { BulgarianInvoiceData } from "../types";
import { HeadingSection } from "./HeadingSection";
import { callApi } from "../../utility/hooks/apiFetch";
import dynamic from "next/dynamic";

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

const MissingOrganizationsModal = dynamic(
  () =>
    import("./MissingOrganizationsModal").then(
      (mod) => mod.MissingOrganizationsModal,
    ),
  {
    ssr: false,
  },
);

type InvoiceFile = {
  file: File;
  id: string;
  status: "pending" | "extracting" | "extracted" | "error";
  data?: BulgarianInvoiceData | null;
  error?: string;
};

type MissingOrganizationFromCache = {
  bulstat: string;
  name: string;
  vatNumber: string | null;
  address: unknown;
  rawLookupData: unknown;
};

type MissingContragentFromCache = MissingOrganizationFromCache & {
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
    composer_name?: string;
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
    MissingOrganizationFromCache[]
  >([]);
  const [missingContragents, setMissingContragents] = useState<
    MissingContragentFromCache[]
  >([]);
  const [missingOrganizationsModalOpen, setMissingOrganizationsModalOpen] =
    useState(false);
  const [savingMissingOrganizations, setSavingMissingOrganizations] =
    useState(false);
  const [savingMissingContragents, setSavingMissingContragents] =
    useState(false);
  const [savingAllMissingEntities, setSavingAllMissingEntities] =
    useState(false);
  const accountComposerName = account?.composer_name || "";

  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId);

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

    if (organizations.length > 0 || contragents.length > 0) {
      setMissingOrganizations(organizations);
      setMissingContragents(contragents);
      setMissingOrganizationsModalOpen(true);
    }
  };

  const saveMissingOrganizations = async (): Promise<Map<string, number>> => {
    const createdOrganizationsByBulstat = new Map<string, number>();

    if (missingOrganizations.length === 0) {
      return createdOrganizationsByBulstat;
    }

    for (const org of missingOrganizations) {
      const createdOrganization = await callApi(
        "/organizations/add",
        {
          method: "POST",
          body: JSON.stringify({
            bulstat: org.bulstat,
            name: org.name,
            vatNumber: org.vatNumber,
            address: org.address ?? {},
            rawLookupData: org.rawLookupData,
          }),
        },
        false,
      );

      if (createdOrganization?.bulstat && createdOrganization?.id) {
        createdOrganizationsByBulstat.set(
          normalizeEik(createdOrganization.bulstat),
          createdOrganization.id,
        );
      }
    }

    setMissingOrganizations([]);
    return createdOrganizationsByBulstat;
  };

  const saveMissingContragents = async (
    createdOrganizationsByBulstat: Map<string, number> = new Map(),
  ) => {
    if (missingContragents.length === 0) {
      return { unresolved: 0 };
    }

    const unresolvedContragents: MissingContragentFromCache[] = [];

    for (const contragent of missingContragents) {
      // First, try to use the existing organizationId if available
      // If not, check if it was newly created from the save-all flow
      // If still not found, mark as unresolved
      const organizationId =
        contragent.organizationId !== null
          ? contragent.organizationId
          : createdOrganizationsByBulstat.get(
              normalizeEik(contragent.organizationBulstat),
            ) || null;

      if (!organizationId) {
        console.warn(
          `[Contragent Save] Failed to resolve organizationId for contragent ${contragent.bulstat} (seller organization: ${contragent.organizationBulstat}). ` +
            `Backend returned organizationId: ${contragent.organizationId}, ` +
            `CreatedMap size: ${createdOrganizationsByBulstat.size}, ` +
            `CreatedMap keys: [${Array.from(createdOrganizationsByBulstat.keys()).join(", ")}], ` +
            `This means the seller organization (${contragent.organizationBulstat}) is not in your account and was not created in this flow.`,
        );
        unresolvedContragents.push(contragent);
        continue;
      }

      await callApi(
        "/contragents/add",
        {
          method: "POST",
          body: JSON.stringify({
            organizationId,
            bulstat: contragent.bulstat,
            name: contragent.name,
            vatNumber: contragent.vatNumber,
            address: contragent.address ?? {},
            rawLookupData: contragent.rawLookupData,
          }),
        },
        false,
      );
    }

    setMissingContragents(unresolvedContragents);

    if (unresolvedContragents.length > 0) {
      setErrorMsg(
        t("missingOrganizationsModal.unresolvedContragents", {
          count: unresolvedContragents.length,
        }),
      );
    }

    return { unresolved: unresolvedContragents.length };
  };

  const handleSaveOrganizations = async () => {
    if (missingOrganizations.length === 0) {
      if (missingContragents.length === 0) {
        setMissingOrganizationsModalOpen(false);
      }
      return;
    }

    setSavingMissingOrganizations(true);
    try {
      await saveMissingOrganizations();
      if (missingContragents.length === 0) {
        setMissingOrganizationsModalOpen(false);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("extractFailed"));
    } finally {
      setSavingMissingOrganizations(false);
    }
  };

  const handleSaveContragents = async () => {
    if (missingContragents.length === 0) {
      if (missingOrganizations.length === 0) {
        setMissingOrganizationsModalOpen(false);
      }
      return;
    }

    setSavingMissingContragents(true);
    try {
      const result = await saveMissingContragents();
      if (result.unresolved === 0 && missingOrganizations.length === 0) {
        setMissingOrganizationsModalOpen(false);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("extractFailed"));
    } finally {
      setSavingMissingContragents(false);
    }
  };

  const handleSaveAllMissingOrganizations = async () => {
    if (missingOrganizations.length === 0 && missingContragents.length === 0) {
      setMissingOrganizationsModalOpen(false);
      return;
    }

    setSavingAllMissingEntities(true);
    try {
      const createdOrganizationsByBulstat = await saveMissingOrganizations();
      const { unresolved } = await saveMissingContragents(
        createdOrganizationsByBulstat,
      );

      if (unresolved === 0) {
        setMissingOrganizationsModalOpen(false);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("extractFailed"));
    } finally {
      setSavingAllMissingEntities(false);
    }
  };

  const processFile = async (
    file: File,
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
      if (!data) {
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
        status: "pending",
      });

      filePromises.push(
        (async () => {
          try {
            const stepTimer = cycleAiStep();
            const data = await processFile(file);
            clearInterval(stepTimer);

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
              prev.map((inv) =>
                inv.id === id ? { ...inv, status: "extracted", data } : inv,
              ),
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
    invoiceDataList: BulgarianInvoiceData[],
    isBulk: boolean = false,
  ) => {
    const setLoading = isBulk ? setDownloadingAll : setDownloading;
    setLoading(true);
    try {
      for (const invoiceData of invoiceDataList) {
        // Ensure composer_name is always present in the data sent to the API
        const dataToSend = {
          ...invoiceData,
          composer_name: invoiceData.composer_name || accountComposerName || "",
        };

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
        a.download = `фактура-${invoiceData.invoiceNumber ?? "generated"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        // Add a small delay between downloads to avoid issues (only for bulk)
        if (isBulk) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (invoiceData: BulgarianInvoiceData) => {
    await generateAndDownloadPdfs([invoiceData], false);
  };

  const handleDownloadAll = async () => {
    const validInvoices = invoices
      .filter((inv) => inv.data)
      .map((inv) => inv.data!);
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

      <MissingOrganizationsModal
        open={missingOrganizationsModalOpen}
        onClose={() => setMissingOrganizationsModalOpen(false)}
        onSaveOrganizations={handleSaveOrganizations}
        onSaveContragents={handleSaveContragents}
        onSaveAll={handleSaveAllMissingOrganizations}
        organizations={missingOrganizations.map((org) => ({
          bulstat: org.bulstat,
          name: org.name,
        }))}
        contragents={missingContragents.map((contragent) => ({
          bulstat: contragent.bulstat,
          name: contragent.name,
        }))}
        savingOrganizations={savingMissingOrganizations}
        savingContragents={savingMissingContragents}
        savingAll={savingAllMissingEntities}
        t={t}
      />
    </div>
  );
};

export default InvoiceUploader;
