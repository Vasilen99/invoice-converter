"use client";

import { useTranslations } from "next-intl";
import {
  SelectValue,
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type BankDetailsOption = {
  bank: string;
  iban: string;
  bic: string;
};

interface StepThreeContentProps {
  invoiceNumber: string;
  onInvoiceNumberChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
  taxEventDate: string;
  onTaxEventDateChange: (value: string) => void;
  locationOptions: string[];
  selectedLocationOption: string;
  onLocationOptionChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  bankOptions: BankDetailsOption[];
  selectedBankOption: string;
  onBankOptionChange: (value: string) => void;
  bank: string;
  onBankChange: (value: string) => void;
  iban: string;
  onIbanChange: (value: string) => void;
  bic: string;
  onBicChange: (value: string) => void;
  subtotal: number;
  vatAmount: number;
  total: number;
  onPreview: () => void;
}

export const StepThreeContent = ({
  invoiceNumber,
  onInvoiceNumberChange,
  currency,
  onCurrencyChange,
  invoiceDate,
  onInvoiceDateChange,
  taxEventDate,
  onTaxEventDateChange,
  locationOptions,
  selectedLocationOption,
  onLocationOptionChange,
  location,
  onLocationChange,
  bankOptions,
  selectedBankOption,
  onBankOptionChange,
  bank,
  onBankChange,
  iban,
  onIbanChange,
  bic,
  onBicChange,
  subtotal,
  vatAmount,
  total,
  onPreview,
}: StepThreeContentProps) => {
  const t = useTranslations("createInvoice.step3");
  return (
    <div className="flex flex-col gap-6">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>{t("invoiceNumber")}</Label>
          <Input
            value={invoiceNumber}
            onChange={(event) => onInvoiceNumberChange(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("currency")}</Label>
          <Input
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("invoiceDate")}</Label>
          <Input
            type="date"
            value={invoiceDate}
            onChange={(event) => onInvoiceDateChange(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("taxEventDate")}</Label>
          <Input
            type="date"
            value={taxEventDate}
            onChange={(event) => onTaxEventDateChange(event.target.value)}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>{t("location")}</Label>
          <Select
            value={selectedLocationOption}
            onValueChange={(value) => {
              onLocationOptionChange(value);
              if (value !== "manual") {
                onLocationChange(value);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectLocation")} />
            </SelectTrigger>
            <SelectContent>
              {locationOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value="manual">{t("manualEntry")}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={location}
            onChange={(event) => {
              onLocationOptionChange("manual");
              onLocationChange(event.target.value);
            }}
            placeholder={t("enterLocation")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("bankDetails")}</Label>
          <Select
            value={selectedBankOption}
            onValueChange={(value) => {
              onBankOptionChange(value);
              if (value === "manual") {
                return;
              }

              const selected = bankOptions[Number(value)];
              if (!selected) {
                return;
              }

              onBankChange(selected.bank);
              onIbanChange(selected.iban);
              onBicChange(selected.bic);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectBankDetails")} />
            </SelectTrigger>
            <SelectContent>
              {bankOptions.map((option, index) => (
                <SelectItem
                  key={`${option.bank}-${option.iban}-${index}`}
                  value={String(index)}
                >
                  {(option.bank || "-") +
                    " / " +
                    (option.iban || "-") +
                    " / " +
                    (option.bic || "-")}
                </SelectItem>
              ))}
              <SelectItem value="manual">{t("manualEntry")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid gap-2">
            <Input
              value={bank}
              onChange={(event) => {
                onBankOptionChange("manual");
                onBankChange(event.target.value);
              }}
              placeholder={t("bank")}
            />
            <Input
              value={iban}
              onChange={(event) => {
                onBankOptionChange("manual");
                onIbanChange(event.target.value);
              }}
              placeholder="IBAN"
            />
            <Input
              value={bic}
              onChange={(event) => {
                onBankOptionChange("manual");
                onBicChange(event.target.value);
              }}
              placeholder={t("bic")}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <div className="flex justify-between">
          <span>{t("taxBase")}:</span>
          <span>
            {subtotal.toFixed(2)} {currency}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t("vatAmount")}:</span>
          <span>
            {vatAmount.toFixed(2)} {currency}
          </span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>{t("total")}:</span>
          <span>
            {total.toFixed(2)} {currency}
          </span>
        </div>
      </div>

      <div className="rounded-lg p-4">
        <p className="text-sm text-primary mb-3">
          {t("previewInvoiceBeforeSaving")}
        </p>
        <Button
          variant="outline"
          className="w-full text-primary bg-primary-foreground hover:text-primary/50!"
          onClick={onPreview}
        >
          {t("previewInvoice")}
        </Button>
      </div>
    </div>
  );
};
