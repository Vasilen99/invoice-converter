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
}) => {
  const t = useTranslations("createInvoice.step2");
  return (
    <div className="flex flex-col gap-6">
      {/* Historical Templates */}
      {lineItemTemplates.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="font-medium text-sm">{t("previouslyAddedItems")}</h4>
          <div className="flex flex-col gap-2">
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

      <div className="flex flex-col gap-3">
        {lineItemsWithTotals.map((item) => (
          <div
            key={item.id}
            className={`grid items-center gap-2 border rounded-md p-3 ${
              layout === "vertical" ? "lg:grid-rows-3" : "lg:grid-cols-12"
            }`}
          >
            <div className="lg:col-span-4 flex lg:flex-col flex-row gap-2">
              <Label>{t("description")}</Label>
              <Input
                value={item.description}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "description", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-1 flex lg:flex-col flex-row gap-2">
              <Label>{t("unit")}</Label>
              <Input
                value={item.unit}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "unit", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-1 flex lg:flex-col flex-row gap-2">
              <Label>{t("quantity")}</Label>
              <Input
                value={item.quantity}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "quantity", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-2 flex lg:flex-col flex-row gap-2">
              <Label>{t("unitPrice")}</Label>
              <Input
                value={item.unitPrice}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "unitPrice", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-1 flex lg:flex-col flex-row gap-2">
              <Label>{t("VAT")} %</Label>
              <Input
                value={item.vatPercent}
                onChange={(event) =>
                  onUpdateLineItem(item.id, "vatPercent", event.target.value)
                }
              />
            </div>
            <div className="lg:col-span-2 flex lg:flex-col flex-row gap-2">
              <Label>{t("value")}</Label>
              <div className="flex items-center h-10 rounded-md border border-input bg-background px-3 py-2">
                {item.lineTotal.toFixed(2)}
              </div>
            </div>
            <div className="lg:col-span-1 flex items-start">
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
    </div>
  );
};
