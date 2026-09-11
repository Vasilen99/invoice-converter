"use client";

import React from "react";
import {
  SelectValue,
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";

type OrganizationOrContragent = {
  id: number;
  name: string;
};

interface StepOneContentProps {
  organizations: OrganizationOrContragent[];
  selectedOrganization: OrganizationOrContragent | null;
  onOrganizationChange: (org: OrganizationOrContragent) => void;
  contragents: OrganizationOrContragent[];
  selectedContragent: OrganizationOrContragent | null;
  onContragentChange: (contragent: OrganizationOrContragent) => void;
  isLoadingPrefill: boolean;
}

export const StepOneContent: React.FC<StepOneContentProps> = ({
  organizations,
  selectedOrganization,
  onOrganizationChange,
  contragents,
  selectedContragent,
  onContragentChange,
  isLoadingPrefill,
}) => {
  const t = useTranslations("createInvoice");

  return (
    <div className="flex lg:flex-row flex-col gap-12">
      <div className="flex flex-col gap-2 items-start w-full">
        <Label>{t("organizations")}</Label>
        <Select
          value={selectedOrganization ? selectedOrganization.id.toString() : ""}
          onValueChange={(value) => {
            const selected = organizations.find(
              (org) => org.id.toString() === value,
            );

            if (selected && selectedOrganization?.id !== selected.id) {
              onOrganizationChange(selected);
            }
          }}
          disabled={isLoadingPrefill}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("selectOrganization")} />
          </SelectTrigger>
          <SelectContent className="bg-primary-foreground">
            {organizations.map((org) => (
              <SelectItem
                className="hover:cursor-pointer! hover:bg-primary/20"
                key={org.id}
                value={org.id.toString()}
              >
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2 items-start w-full">
        <Label>{t("contragents")}</Label>
        <Select
          value={selectedContragent ? selectedContragent.id.toString() : ""}
          onValueChange={(value) => {
            const selected = contragents.find(
              (contragent) => contragent.id.toString() === value,
            );
            if (selected && selectedContragent?.id !== selected.id) {
              onContragentChange(selected);
            }
          }}
          disabled={!selectedOrganization || isLoadingPrefill}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("selectContragent")} />
          </SelectTrigger>
          <SelectContent className="bg-primary-foreground">
            {contragents.map((contragent) => (
              <SelectItem
                className="hover:cursor-pointer! hover:bg-primary/20"
                key={contragent.id}
                value={contragent.id.toString()}
              >
                {contragent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
