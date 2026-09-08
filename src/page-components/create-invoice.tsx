"use client";
import { HeadingSection } from "@/components/HeadingSection";
import { useTranslations } from "next-intl";
import StepsIndicator from "@/components/StepsIndicator";
import {
  SelectValue,
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { callApi } from "../../utility/hooks/apiFetch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InvoicePreviewModal } from "@/components/InvoicePreviewModal";
import { BulgarianInvoiceData } from "@/types";
import { StepOneContent } from "./invoice-steps/StepOneContent";
import { StepTwoContent } from "./invoice-steps/StepTwoContent";
import { StepThreeContent } from "./invoice-steps/StepThreeContent";
import { uploadPdfToSupabase } from "../../utility/pdf-upload";

type OrganizationOrContragent = {
  id: number;
  name: string;
};

type InvoiceLineItemDraft = {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatPercent: string;
};

type BankDetailsOption = {
  bank: string;
  iban: string;
  bic: string;
};

type AddressData = {
  settlement?: string;
  street?: string;
} | null;

type SelectedPartyDetails = {
  id: number;
  name: string;
  bulstat: string | null;
  vatNumber: string | null;
  molName: string | null;
  address: AddressData;
};

type OrganizationDetails = SelectedPartyDetails & {
  bank: string | null;
  iban: string | null;
  bic: string | null;
};

type LineItemTemplate = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatPercent: string;
};

type CreateInvoicePrefillData = {
  invoiceNumberSuggestion: string;
  organization: OrganizationDetails;
  contragent: SelectedPartyDetails;
  lineItemTemplates: LineItemTemplate[];
  locationOptions: string[];
  bankOptions: BankDetailsOption[];
};

type AccountProps = {
  id: number;
  organizations: OrganizationOrContragent[];
} | null;
type CreateInvoiceMainProps = {
  data: AccountProps | null;
};

export const CreateInvoiceMain = ({ data }: CreateInvoiceMainProps) => {
  const t = useTranslations("createInvoice");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedOrganization, setSelectedOrganization] =
    useState<OrganizationOrContragent | null>(null);
  const [selectedContragent, setSelectedContragent] =
    useState<OrganizationOrContragent | null>(null);
  const [contragents, setContragents] = useState<OrganizationOrContragent[]>(
    [],
  );
  const [lineItemTemplates, setLineItemTemplates] = useState<
    LineItemTemplate[]
  >([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [bankOptions, setBankOptions] = useState<BankDetailsOption[]>([]);
  const [selectedLocationOption, setSelectedLocationOption] =
    useState<string>("");
  const [selectedBankOption, setSelectedBankOption] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>("");
  const [taxEventDate, setTaxEventDate] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [bank, setBank] = useState<string>("");
  const [iban, setIban] = useState<string>("");
  const [bic, setBic] = useState<string>("");
  const [selectedOrganizationDetails, setSelectedOrganizationDetails] =
    useState<OrganizationDetails | null>(null);
  const [selectedContragentDetails, setSelectedContragentDetails] =
    useState<SelectedPartyDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingPrefill, setIsLoadingPrefill] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);

  const accountId = data?.id || null;

  const normalizeNumber = (value: string): number => {
    const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const lineItemsWithTotals = useMemo(
    () =>
      lineItems.map((item) => {
        const quantity = normalizeNumber(item.quantity);
        const unitPrice = normalizeNumber(item.unitPrice);
        const lineTotal = quantity * unitPrice;
        return {
          ...item,
          lineTotal,
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

  const isNextStepDisabled = useMemo(() => {
    if (currentStep === 1) {
      return !selectedOrganization || !selectedContragent;
    }

    if (currentStep === 2) {
      return lineItems.length === 0;
    }

    return (
      !invoiceNumber.trim() ||
      !invoiceDate ||
      !taxEventDate ||
      !location.trim() ||
      !bank.trim() ||
      !iban.trim() ||
      !bic.trim()
    );
  }, [
    currentStep,
    selectedOrganization,
    selectedContragent,
    lineItems.length,
    invoiceNumber,
    invoiceDate,
    taxEventDate,
    location,
    bank,
    iban,
    bic,
  ]);

  const resetStepTwoAndThree = () => {
    setLineItems([]);
    setSelectedTemplates([]);
    setLineItemTemplates([]);
    setLocationOptions([]);
    setBankOptions([]);
    setSelectedLocationOption("");
    setSelectedBankOption("");
    setInvoiceNumber("");
    setLocation("");
    setBank("");
    setIban("");
    setBic("");
    setSelectedOrganizationDetails(null);
    setSelectedContragentDetails(null);

    const today = new Date().toISOString().slice(0, 10);
    setInvoiceDate(today);
    setTaxEventDate(today);
  };

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
      lineItems.length === 0
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
      bank: bank.trim(),
      iban: iban.trim(),
      bic: bic.trim(),
    };
  };

  const handleGeneratePdf = async () => {
    const invoiceData = buildInvoiceData();
    if (!invoiceData) {
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceData),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setGeneratedPdfUrl(url);

      // Trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `faktura-${invoiceData.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Грешка при генериране на PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const submitInvoice = async () => {
    const invoiceData = buildInvoiceData();
    if (!invoiceData) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Generate PDF and upload to Supabase storage
      let pdfFileUrl: string | null = null;
      try {
        const pdfResponse = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoiceData),
        });

        if (pdfResponse.ok) {
          const pdfBlob = await pdfResponse.blob();
          // Upload to Supabase storage and get public URL
          pdfFileUrl = await uploadPdfToSupabase(
            pdfBlob,
            invoiceData.invoiceNumber,
            accountId || undefined,
            invoiceData.sellerEik,
          );
        }
      } catch (pdfError) {
        console.warn(
          "PDF generation or upload failed, continuing without PDF:",
          pdfError,
        );
      }

      // Step 2: Record invoice with Supabase storage PDF URL
      await callApi(
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
      );

      setCurrentStep(1);
      setSelectedContragent(null);
      setContragents([]);
      setSelectedOrganization(null);
      resetStepTwoAndThree();
      setIsPreviewModalOpen(false);
      setGeneratedPdfUrl(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStepHandler = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    submitInvoice();
  };

  const prevStepHandler = () => {
    if (currentStep === 1) return;
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  useEffect(() => {
    if (selectedOrganization && accountId) {
      const fetchContragents = async () => {
        const contragentsData = await callApi(
          `/contragents?organizationId=${selectedOrganization.id}&accountId=${accountId}`,
        );
        if (contragentsData) {
          setContragents(contragentsData);
          return;
        }

        setContragents([]);
      };

      fetchContragents();
    }

    if (!selectedOrganization) {
      setContragents([]);
    }
  }, [selectedOrganization, accountId]);

  useEffect(() => {
    if (!selectedOrganization || !selectedContragent) {
      return;
    }

    const fetchPrefillData = async () => {
      setIsLoadingPrefill(true);
      const prefillData = (await callApi(
        `/create-invoice/prefill?organizationId=${selectedOrganization.id}&contragentId=${selectedContragent.id}`,
      )) as CreateInvoicePrefillData | null;

      if (!prefillData) {
        setIsLoadingPrefill(false);
        return;
      }

      setLineItemTemplates(prefillData.lineItemTemplates ?? []);
      setLocationOptions(prefillData.locationOptions ?? []);
      setBankOptions(prefillData.bankOptions ?? []);
      setInvoiceNumber(prefillData.invoiceNumberSuggestion ?? "");
      setSelectedOrganizationDetails(prefillData.organization ?? null);
      setSelectedContragentDetails(prefillData.contragent ?? null);

      const today = new Date().toISOString().slice(0, 10);
      setInvoiceDate(today);
      setTaxEventDate(today);

      if ((prefillData.locationOptions ?? []).length === 1) {
        const defaultLocation = prefillData.locationOptions[0];
        setLocation(defaultLocation);
        setSelectedLocationOption(defaultLocation);
      }

      if ((prefillData.bankOptions ?? []).length === 1) {
        const defaultBank = prefillData.bankOptions[0];
        setBank(defaultBank.bank);
        setIban(defaultBank.iban);
        setBic(defaultBank.bic);
        setSelectedBankOption("0");
      }

      setIsLoadingPrefill(false);
    };

    fetchPrefillData();
  }, [selectedOrganization, selectedContragent]);

  const stepOneView = (
    <StepOneContent
      organizations={data?.organizations || []}
      selectedOrganization={selectedOrganization}
      onOrganizationChange={(selected) => {
        setSelectedOrganization(selected);
        setSelectedContragent(null);
        resetStepTwoAndThree();
        if (currentStep > 1) {
          setCurrentStep(1);
        }
      }}
      contragents={contragents}
      selectedContragent={selectedContragent}
      onContragentChange={(selected) => {
        setSelectedContragent(selected);
        resetStepTwoAndThree();
      }}
      isLoadingPrefill={isLoadingPrefill}
    />
  );

  const stepTwoView = (
    <StepTwoContent
      lineItemTemplates={lineItemTemplates}
      selectedTemplates={selectedTemplates}
      onTemplateToggle={(index, isChecked) => {
        if (isChecked) {
          setSelectedTemplates((prev) => [...prev, index]);
        } else {
          setSelectedTemplates((prev) => prev.filter((item) => item !== index));
        }
      }}
      onAddTemplates={addSelectedTemplates}
      lineItems={lineItems}
      lineItemsWithTotals={lineItemsWithTotals}
      onAddManualLineItem={addManualLineItem}
      onUpdateLineItem={updateLineItem}
      onRemoveLineItem={removeLineItem}
    />
  );

  const stepThreeView = (
    <StepThreeContent
      invoiceNumber={invoiceNumber}
      onInvoiceNumberChange={setInvoiceNumber}
      currency={currency}
      onCurrencyChange={setCurrency}
      invoiceDate={invoiceDate}
      onInvoiceDateChange={setInvoiceDate}
      taxEventDate={taxEventDate}
      onTaxEventDateChange={setTaxEventDate}
      locationOptions={locationOptions}
      selectedLocationOption={selectedLocationOption}
      onLocationOptionChange={setSelectedLocationOption}
      location={location}
      onLocationChange={setLocation}
      bankOptions={bankOptions}
      selectedBankOption={selectedBankOption}
      onBankOptionChange={setSelectedBankOption}
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
  );

  return (
    <section>
      <HeadingSection title={t("header")} subtitle={t("subheader")} />
      {!data ? (
        <span>
          Нямате конфигуриран профил в платформата, трябва да конфигурирате
          вашият акаунт в платформата, за да имате достъп до всички функции.
        </span>
      ) : (
        <>
          <StepsIndicator currentStep={currentStep} />
          <div className="rounded-2xl border border-base-200 p-4 lg:p-6">
            {currentStep === 1 && stepOneView}
            {currentStep === 2 && stepTwoView}
            {currentStep === 3 && stepThreeView}

            <div className="mt-8 flex gap-2.5 justify-between">
              <div>
                {currentStep !== 1 && (
                  <Button variant="outline" onClick={prevStepHandler}>
                    {t("back")}
                  </Button>
                )}
              </div>
              <div className="flex gap-2.5">
                <Button
                  onClick={nextStepHandler}
                  disabled={
                    isNextStepDisabled || isSubmitting || isLoadingPrefill
                  }
                >
                  {currentStep === 3
                    ? isSubmitting
                      ? "Записване..."
                      : "Създай фактура"
                    : t("continiue")}
                </Button>
              </div>
            </div>
          </div>

          <InvoicePreviewModal
            isOpen={isPreviewModalOpen}
            onClose={() => setIsPreviewModalOpen(false)}
            invoiceData={buildInvoiceData()}
            isGeneratingPdf={isGeneratingPdf}
            onDownloadPdf={handleGeneratePdf}
          />
        </>
      )}
    </section>
  );
};
