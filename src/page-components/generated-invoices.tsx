"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChevronDown, FileText, Loader2, RefreshCw } from "lucide-react";
import { HeadingSection } from "@/components/HeadingSection";
import { StepTwoContent } from "@/page-components/invoice-steps/StepTwoContent";
import { StepThreeContent } from "@/page-components/invoice-steps/StepThreeContent";
import { Button } from "@/components/ui/button";
import { InvoicePreviewModal } from "@/components/InvoicePreviewModal";
import { callApi } from "../../utility/hooks/apiFetch";
import { uploadPdfToSupabase } from "../../utility/pdf-upload";
import { useGlobalStore } from "@/store/global";
import type { BulgarianInvoiceData } from "@/types";
import type {
  GeneratedInvoicesProps,
  OrganizationWithGeneratedInvoices,
  InvoiceLineItemDraft,
  OrganizationDetails,
  SelectedPartyDetails,
  GeneratedInvoiceSummary,
  TemplateResponse,
} from "../../utility/types";
import { Input } from "@/components/ui/input";
import {
  formatDateLabel,
  getTodayForInput,
  toIsoDateOrNull,
} from "../../utility/date-formatter";

const NoAccountFallback = dynamic(
  () => import("@/components/NoAccountFallback"),
  {
    ssr: false,
  },
);

export default function GeneratedInvoices({
  organizations,
  hasAccount,
  accountId,
  composerName,
}: GeneratedInvoicesProps) {
  const t = useTranslations("generatedInvoices");
  const { setAlertStatus } = useGlobalStore();

  const [organizationsList, setOrganizationsList] =
    useState<OrganizationWithGeneratedInvoices[]>(organizations);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedOrganizationId, setExpandedOrganizationId] = useState<
    number | null
  >(organizations[0]?.id ?? null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
    null,
  );
  const [selectedSourceInvoiceNumber, setSelectedSourceInvoiceNumber] =
    useState<string>("");
  const [lineItemTemplates, setLineItemTemplates] = useState<
    Array<{
      description: string;
      unit: string;
      quantity: string;
      unitPrice: string;
      vatPercent: string;
    }>
  >([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(() =>
    getTodayForInput(),
  );
  const [taxEventDate, setTaxEventDate] = useState<string>(() =>
    getTodayForInput(),
  );
  const [location, setLocation] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [bank, setBank] = useState<string>("");
  const [iban, setIban] = useState<string>("");
  const [bic, setBic] = useState<string>("");
  const [selectedOrganizationDetails, setSelectedOrganizationDetails] =
    useState<OrganizationDetails | null>(null);
  const [selectedContragentDetails, setSelectedContragentDetails] =
    useState<SelectedPartyDetails | null>(null);
  const [resolvedComposerName, setResolvedComposerName] = useState<string>(
    composerName ?? "",
  );
  const [isLoadingTemplate, setIsLoadingTemplate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  const normalizeNumber = (value: string): number => {
    const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const filteredOrganizations = useMemo(() => {
    if (!searchQuery.trim()) {
      return organizationsList;
    }

    const query = searchQuery.toLowerCase().trim();

    return organizationsList.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        org.bulstat?.toLowerCase().includes(query),
    );
  }, [organizationsList, searchQuery]);

  const lineItemsWithTotals = useMemo(
    () =>
      lineItems.map((item) => {
        const quantity = normalizeNumber(item.quantity);
        const unitPrice = normalizeNumber(item.unitPrice);
        return {
          ...item,
          lineTotal: quantity * unitPrice,
        };
      }),
    [lineItems],
  );

  const totals = useMemo(() => {
    const subtotal = lineItemsWithTotals.reduce(
      (acc, item) => acc + item.lineTotal,
      0,
    );

    const vatAmount = lineItemsWithTotals.reduce((acc, item) => {
      const vatPercent = normalizeNumber(item.vatPercent);
      return acc + item.lineTotal * (vatPercent / 100);
    }, 0);

    return {
      subtotal,
      vatAmount,
      total: subtotal + vatAmount,
    };
  }, [lineItemsWithTotals]);

  const isGenerateDisabled = useMemo(
    () =>
      lineItems.length === 0 ||
      !selectedOrganizationDetails ||
      !selectedContragentDetails ||
      !invoiceNumber.trim() ||
      !invoiceDate ||
      !taxEventDate ||
      !toIsoDateOrNull(invoiceDate) ||
      !toIsoDateOrNull(taxEventDate) ||
      !bank.trim() ||
      !iban.trim() ||
      isSubmitting,
    [
      lineItems.length,
      selectedOrganizationDetails,
      selectedContragentDetails,
      invoiceNumber,
      invoiceDate,
      taxEventDate,
      bank,
      iban,
      isSubmitting,
    ],
  );

  const addManualLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        description: "",
        unit: "бр.",
        quantity: "1",
        unitPrice: "0",
        vatPercent: "20",
      },
    ]);
  };

  const addSelectedTemplates = () => {
    if (!selectedTemplates.length) return;

    setLineItems((prev) => {
      const next = [...prev];

      selectedTemplates.forEach((templateIndex) => {
        const template = lineItemTemplates[Number(templateIndex)];
        if (!template) return;

        const existing = next.find(
          (item) =>
            item.description === template.description &&
            item.unitPrice === template.unitPrice &&
            item.vatPercent === template.vatPercent,
        );

        if (!existing) {
          next.push({
            id: `${Date.now()}-${Math.random()}`,
            description: template.description,
            unit: template.unit,
            quantity: template.quantity,
            unitPrice: template.unitPrice,
            vatPercent: template.vatPercent,
          });
        }
      });

      return next;
    });

    setSelectedTemplates([]);
  };

  const updateLineItem = (
    id: string,
    field: keyof Omit<InvoiceLineItemDraft, "id">,
    value: string,
  ) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const buildInvoiceData = (): BulgarianInvoiceData | null => {
    if (
      !selectedOrganizationDetails ||
      !selectedContragentDetails ||
      lineItemsWithTotals.length === 0
    ) {
      return null;
    }

    return {
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      taxEventDate,
      location: location.trim(),
      sellerName: selectedOrganizationDetails.name,
      sellerEik: selectedOrganizationDetails.bulstat ?? "",
      sellerVatNumber: selectedOrganizationDetails.vatNumber ?? "",
      sellerCity: selectedOrganizationDetails.address?.settlement?.trim() ?? "",
      sellerAddress: selectedOrganizationDetails.address?.street?.trim() ?? "",
      sellerMol: selectedOrganizationDetails.molName ?? "",
      buyerName: selectedContragentDetails.name,
      buyerEik: selectedContragentDetails.bulstat ?? "",
      buyerVatNumber: selectedContragentDetails.vatNumber ?? "",
      buyerCity: selectedContragentDetails.address?.settlement?.trim() ?? "",
      buyerAddress: selectedContragentDetails.address?.street?.trim() ?? "",
      buyerMol: selectedContragentDetails.molName ?? "",
      lineItems: lineItemsWithTotals.map((item) => ({
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatPercent: item.vatPercent,
        value: item.lineTotal.toFixed(2),
      })),
      subtotal: totals.subtotal.toFixed(2),
      vatAmount: totals.vatAmount.toFixed(2),
      total: totals.total.toFixed(2),
      totalInWords: "",
      currency,
      composer_name: resolvedComposerName || "",
      bank: bank.trim(),
      iban: iban.trim(),
      bic: bic.trim(),
    };
  };

  const selectInvoiceTemplate = async (
    organizationId: number,
    invoice: GeneratedInvoiceSummary,
  ) => {
    setSelectedInvoiceId(invoice.id);
    setIsLoadingTemplate(true);

    const templateData = (await callApi(
      `/generated-invoices/template?invoiceId=${invoice.id}`,
      undefined,
      true,
    )) as TemplateResponse | null;

    if (!templateData) {
      setIsLoadingTemplate(false);
      return;
    }

    setExpandedOrganizationId(organizationId);
    setSelectedSourceInvoiceNumber(
      templateData.sourceInvoice.sourceInvoiceNumber,
    );
    const today = getTodayForInput();
    setInvoiceNumber(templateData.invoiceNumberSuggestion || "");
    setInvoiceDate(templateData.invoiceDate || today);
    setTaxEventDate(templateData.taxEventDate || today);
    setCurrency(templateData.currency || "EUR");
    setLocation(templateData.location || "");
    setSelectedOrganizationDetails(templateData.organization || null);
    setSelectedContragentDetails(templateData.contragent || null);
    setResolvedComposerName(templateData.composerName ?? composerName ?? "");

    // Set bank details from organization
    const org = templateData.organization;
    if (org) {
      setBank(org.bank ?? "");
      setIban(org.iban ?? "");
      setBic(org.bic ?? "");
    }

    const initialLineItems = (templateData.lineItems || []).map(
      (item, index) => ({
        id: `${Date.now()}-${index}`,
        description: item.description || "",
        unit: item.unit || "бр.",
        quantity: item.quantity || "1",
        unitPrice: item.unitPrice || "0",
        vatPercent: item.vatPercent || "20",
      }),
    );

    setLineItems(initialLineItems);
    setLineItemTemplates(
      initialLineItems.map((item) => ({
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatPercent: item.vatPercent,
      })),
    );
    setSelectedTemplates([]);
    setIsLoadingTemplate(false);
  };

  const createInvoiceFromTemplate = async () => {
    const invoiceData = buildInvoiceData();
    if (!invoiceData) {
      return;
    }

    if (invoiceData.invoiceNumber === selectedSourceInvoiceNumber) {
      setAlertStatus({
        status: "warning",
        statusHeader: t("invoiceNumberMustDifferHeader"),
        statusContent: t("invoiceNumberMustDifferMessage"),
      });
      return;
    }

    setIsSubmitting(true);

    const normalizedInvoiceDateISO = toIsoDateOrNull(invoiceDate);

    try {
      let pdfFileUrl: string | null = null;

      try {
        const pdfResponse = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoiceData),
        });

        if (pdfResponse.ok) {
          const pdfBlob = await pdfResponse.blob();

          pdfFileUrl = await uploadPdfToSupabase(
            pdfBlob,
            invoiceData.invoiceNumber,
            accountId || undefined,
            invoiceData.sellerEik,
          );

          const downloadUrl = URL.createObjectURL(pdfBlob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = `faktura-${invoiceData.invoiceNumber}-${invoiceData.sellerEik}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
        }
      } catch (pdfError) {
        console.warn("[generated-invoices] PDF generation failed:", pdfError);
        setAlertStatus({
          status: "error",
          statusHeader: t("pdfGenerationErrorHeader"),
          statusContent: t("pdfGenerationErrorMessage"),
        });
      }

      const recordResult = (await callApi(
        "/record-invoice",
        {
          method: "POST",
          body: JSON.stringify({
            invoiceData,
            generatedPdfUrl: pdfFileUrl,
            skipSourceDocumentCreation: true,
          }),
        },
        true,
      )) as { generatedInvoiceId?: number } | null;

      if (selectedOrganizationDetails && selectedContragentDetails) {
        setOrganizationsList((prev) =>
          prev.map((organization) => {
            if (organization.id !== selectedOrganizationDetails.id) {
              return organization;
            }

            const nextInvoice: GeneratedInvoiceSummary = {
              id: recordResult?.generatedInvoiceId ?? Date.now(),
              displayNumber: invoiceData.invoiceNumber,
              issueDate: new Date(
                normalizedInvoiceDateISO ?? new Date().toISOString(),
              ).toISOString(),
              totalAmount: totals.total.toFixed(2),
              currency: invoiceData.currency,
              status: "ISSUED",
              contragentName: selectedContragentDetails.name,
              lineItemsCount: invoiceData.lineItems.length,
              createdAt: new Date().toISOString(),
            };

            return {
              ...organization,
              generatedInvoices: [
                nextInvoice,
                ...organization.generatedInvoices,
              ],
            };
          }),
        );
      }

      setAlertStatus({
        status: "success",
        statusHeader: t("successCreationHeader"),
        statusContent: t("successCreationMessage"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasAccount) {
    return <NoAccountFallback />;
  }

  return (
    <section className="space-y-6 pb-8">
      <HeadingSection title={t("header")} subtitle={t("subheader")} />

      {organizationsList.length === 0 ? (
        <p className="text-sm text-primary/60">{t("noOrganizations")}</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border p-4 lg:p-5 bg-background space-y-3 h-fit">
            <h3 className="font-semibold text-lg">{t("organizationsTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("organizationsDescription")}
            </p>
            <Input
              placeholder={t("searchPlaceholder") ?? "Search by name or ЕИК..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-6"
            />
            <div className="space-y-3">
              {filteredOrganizations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {searchQuery.trim()
                    ? (t("noOrganizationsFound") ?? "No organizations found")
                    : t("noOrganizations")}
                </p>
              ) : (
                filteredOrganizations.map((organization) => {
                  const isExpanded = expandedOrganizationId === organization.id;
                  const totalInvoices = organization.generatedInvoices.length;

                  return (
                    <div
                      key={organization.id}
                      className="border border-border rounded-xl overflow-hidden"
                    >
                      <button
                        type="button"
                        className="w-full px-4 py-3 bg-muted/40 hover:bg-muted/70 transition flex items-center justify-between gap-4 text-left"
                        onClick={() =>
                          setExpandedOrganizationId((prev) =>
                            prev === organization.id ? null : organization.id,
                          )
                        }
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {organization.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {organization.bulstat
                              ? `ЕИК: ${organization.bulstat}`
                              : "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-semibold">
                            {t("invoicesCount", { count: totalInvoices })}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 space-y-3 bg-background">
                          <div className="text-xs text-muted-foreground">
                            {organization.address?.settlement && (
                              <span className="mr-3">
                                {t("locationLabel")}:{" "}
                                {organization.address.settlement}
                              </span>
                            )}
                            {organization.vatNumber && (
                              <span>
                                {t("vatLabel")}: {organization.vatNumber}
                              </span>
                            )}
                          </div>

                          {totalInvoices === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t("noInvoices")}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {organization.generatedInvoices.map((invoice) => {
                                const isSelected =
                                  selectedInvoiceId === invoice.id;

                                return (
                                  <button
                                    type="button"
                                    key={invoice.id}
                                    className={`w-full border rounded-lg px-3 py-2 text-left transition ${
                                      isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:bg-muted/40"
                                    }`}
                                    onClick={() =>
                                      selectInvoiceTemplate(
                                        organization.id,
                                        invoice,
                                      )
                                    }
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-medium text-sm flex items-center gap-2">
                                        <FileText size={14} />
                                        {invoice.displayNumber}
                                      </p>
                                      <span className="text-xs text-muted-foreground">
                                        {invoice.status}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {invoice.contragentName}
                                    </p>
                                    <div className="mt-1 text-xs text-muted-foreground flex gap-3">
                                      <span>
                                        {t("issueDateLabel")}:{" "}
                                        {formatDateLabel(invoice.issueDate)}
                                      </span>
                                      <span>
                                        {t("totalLabel")}: {invoice.totalAmount}{" "}
                                        {invoice.currency}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4 lg:p-5 bg-background">
            {!selectedInvoiceId && !isLoadingTemplate && (
              <div className="h-full min-h-80 grid place-items-center text-center px-6">
                <div className="space-y-2">
                  <RefreshCw className="mx-auto text-primary/60" size={28} />
                  <p className="font-medium">{t("emptyStateTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("emptyStateDescription")}
                  </p>
                </div>
              </div>
            )}

            {isLoadingTemplate && (
              <div className="h-full min-h-80 grid place-items-center text-center px-6">
                <div className="space-y-2">
                  <Loader2
                    className="mx-auto animate-spin text-primary"
                    size={24}
                  />
                  <p className="font-medium">{t("loadingTemplate")}</p>
                </div>
              </div>
            )}

            {selectedInvoiceId && !isLoadingTemplate && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg">{t("editorTitle")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("editorDescription")}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                    <FileText size={13} />
                    {t("sourceInvoiceLabel")}: {selectedSourceInvoiceNumber}
                  </div>
                </div>

                <StepTwoContent
                  lineItemTemplates={lineItemTemplates}
                  selectedTemplates={selectedTemplates}
                  onTemplateToggle={(index, isChecked) => {
                    if (isChecked) {
                      setSelectedTemplates((prev) => [...prev, index]);
                    } else {
                      setSelectedTemplates((prev) =>
                        prev.filter((item) => item !== index),
                      );
                    }
                  }}
                  onAddTemplates={addSelectedTemplates}
                  lineItems={lineItems}
                  lineItemsWithTotals={lineItemsWithTotals}
                  onAddManualLineItem={addManualLineItem}
                  onUpdateLineItem={updateLineItem}
                  onRemoveLineItem={removeLineItem}
                  layout="vertical"
                />

                <StepThreeContent
                  invoiceNumber={invoiceNumber}
                  onInvoiceNumberChange={setInvoiceNumber}
                  currency={currency}
                  onCurrencyChange={setCurrency}
                  invoiceDate={invoiceDate}
                  onInvoiceDateChange={setInvoiceDate}
                  taxEventDate={taxEventDate}
                  onTaxEventDateChange={setTaxEventDate}
                  location={location}
                  onLocationChange={setLocation}
                  bank={bank}
                  onBankChange={setBank}
                  iban={iban}
                  onIbanChange={setIban}
                  bic={bic}
                  onBicChange={setBic}
                  subtotal={totals.subtotal}
                  vatAmount={totals.vatAmount}
                  total={totals.total}
                  onPreview={() => setIsPreviewModalOpen(true)}
                />

                <Button
                  className="w-full"
                  disabled={isGenerateDisabled}
                  onClick={createInvoiceFromTemplate}
                >
                  {isSubmitting ? t("generating") : t("generateNewInvoice")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <InvoicePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        invoiceData={buildInvoiceData()}
      />
    </section>
  );
}
