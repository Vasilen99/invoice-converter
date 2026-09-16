"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { Checkbox } from "@/components/animate-ui/components/radix/checkbox";
import { useTranslations } from "next-intl";
type LineItemTemplate = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatPercent: string;
};

type InvoiceLineItemDraft = {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatPercent: string;
};

interface StepTwoContentProps {
  lineItemTemplates: LineItemTemplate[];
  selectedTemplates: string[];
  onTemplateToggle: (index: string, isChecked: boolean) => void;
  onAddTemplates: () => void;
  lineItems: InvoiceLineItemDraft[];
  lineItemsWithTotals: (InvoiceLineItemDraft & { lineTotal: number })[];
  onAddManualLineItem: () => void;
  onUpdateLineItem: (
    id: string,
    field: keyof Omit<InvoiceLineItemDraft, "id">,
    value: string,
  ) => void;
  onRemoveLineItem: (id: string) => void;
  layout?: "horizontal" | "vertical";
  totalInWords: string;
  onTotalInWordsChange: (value: string) => void;
  currency?: string;
}

export const StepTwoContent: React.FC<StepTwoContentProps> = ({
  lineItemTemplates,
  selectedTemplates,
  onTemplateToggle,
  onAddTemplates,
  lineItemsWithTotals,
  onAddManualLineItem,
  onUpdateLineItem,
  onRemoveLineItem,
  layout = "horizontal",
  totalInWords,
  onTotalInWordsChange,
  currency = "EUR",
}) => {
  const t = useTranslations("createInvoice.step2");
  return (
    <div className="flex flex-col gap-6">
      {/* Historical Templates */}
      {lineItemTemplates.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="font-medium text-sm">{t("previouslyAddedItems")}</h4>
          <div className="flex flex-col gap-2 max-h-50 overflow-y-auto">
            {lineItemTemplates.map((template, index) => {
              const selected = selectedTemplates.includes(String(index));
              return (
                <label
                  key={`${template.description}-${index}`}
                  className="flex items-center gap-2 border rounded-md p-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(isChecked) => {
                      onTemplateToggle(String(index), isChecked as boolean);
                    }}
                  />
                  <span>
                    {template.description} · {template.unitPrice} · ДДС{" "}
                    {template.vatPercent}%
                  </span>
                </label>
              );
            })}
          </div>
          {selectedTemplates.length > 0 && (
            <Button className="w-fit" onClick={onAddTemplates}>
              {t("addTheSelectedOnes")}
            </Button>
          )}
        </div>
      )}

      {lineItemTemplates.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noItemsFound")}</p>
      )}

      {/* Manual Line Items */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{t("invoiceLineItems")}</h4>
        <Button size="sm" variant="outline" onClick={onAddManualLineItem}>
          {t("addNewItem")}
        </Button>
      </div>

      <div className="flex flex-col overflow-y-auto gap-3">
        {lineItemsWithTotals.map((item) => (
          <div
            key={item.id}
            className={`grid items-center gap-2 border rounded-md p-3 ${
              layout === "vertical" ? "lg:grid-rows-3" : "lg:grid-cols-12"
            }`}
          >
            <div className="lg:col-span-4 flex lg:flex-col flex-row gap-2">
              <Label className="flex-1 lg:flex-none">{t("description")}</Label>
              <Input
                className="flex-1 lg:flex-none"
                value={item.description}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "description", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-1 flex lg:flex-col flex-row gap-2">
              <Label className="flex-1 lg:flex-none">{t("unit")}</Label>
              <Input
                className="flex-1 lg:flex-none"
                value={item.unit}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "unit", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-1 flex lg:flex-col flex-row gap-2">
              <Label className="flex-1 lg:flex-none">{t("quantity")}</Label>
              <Input
                className="flex-1 lg:flex-none"
                value={item.quantity}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "quantity", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-2 flex lg:flex-col flex-row gap-2">
              <Label className="flex-1 lg:flex-none">{t("unitPrice")}</Label>
              <Input
                className="flex-1 lg:flex-none"
                value={item.unitPrice}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "unitPrice", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-1 flex lg:flex-col flex-row gap-2">
              <Label className="flex-1 lg:flex-none">{t("VAT")} %</Label>
              <Input
                className="flex-1 lg:flex-none"
                value={item.vatPercent}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "vatPercent", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-2 flex lg:flex-col flex-row gap-2">
              <Label className="flex-1 lg:flex-none">{t("value")}</Label>
              <div className="flex items-center flex-1 lg:flex-none h-10 rounded-md border border-input bg-background px-3 py-2">
                {item.lineTotal.toFixed(2)}
              </div>
            </div>
            <div className="lg:col-span-1 flex rounded-full">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onRemoveLineItem(item.id)}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Totals Summary and Total in Words */}
      {lineItemsWithTotals.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border p-4 text-sm bg-muted/30">
            <div className="flex justify-between mb-2">
              <span className="font-medium">{t("subtotal")}:</span>
              <span>
                {lineItemsWithTotals
                  .reduce((acc, item) => acc + item.lineTotal, 0)
                  .toFixed(2)}{" "}
                {currency}
              </span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="font-medium">{t("VAT")}:</span>
              <span>
                {lineItemsWithTotals
                  .reduce((acc, item) => {
                    const vatPercent = Number.parseFloat(item.vatPercent) || 0;
                    return acc + item.lineTotal * (vatPercent / 100);
                  }, 0)
                  .toFixed(2)}{" "}
                {currency}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-bold">{t("total")}:</span>
              <span className="font-bold">
                {(
                  lineItemsWithTotals.reduce(
                    (acc, item) => acc + item.lineTotal,
                    0,
                  ) +
                  lineItemsWithTotals.reduce((acc, item) => {
                    const vatPercent = Number.parseFloat(item.vatPercent) || 0;
                    return acc + item.lineTotal * (vatPercent / 100);
                  }, 0)
                ).toFixed(2)}{" "}
                {currency}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("totalInWords") || "Total in Words"}</Label>
            <Input
              value={totalInWords}
              onChange={(event) => onTotalInWordsChange(event.target.value)}
              placeholder={
                t("enterTotalInWords") || "Enter total amount in words"
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("enterTotalInWordsDescription") ||
                "Write the total amount in Bulgarian words based on the calculated sum above"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
