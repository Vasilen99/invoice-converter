"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/animate-ui/components/radix/dialog";
import { Loader2 } from "lucide-react";

type MissingOrganizationItem = {
  bulstat: string;
  name: string;
};

type MissingOrganizationsModalProps = {
  open: boolean;
  onClose: () => void;
  onSaveOrganizations: () => Promise<void>;
  onSaveContragents: () => Promise<void>;
  onSaveAll: () => Promise<void>;
  organizations: MissingOrganizationItem[];
  contragents: MissingOrganizationItem[];
  savingOrganizations: boolean;
  savingContragents: boolean;
  savingAll: boolean;
  t: (key: string, options?: Record<string, string | number>) => string;
};

export const MissingOrganizationsModal = ({
  open,
  onClose,
  onSaveOrganizations,
  onSaveContragents,
  onSaveAll,
  organizations,
  contragents,
  savingOrganizations,
  savingContragents,
  savingAll,
  t,
}: MissingOrganizationsModalProps) => {
  const isSavingAny = savingOrganizations || savingContragents || savingAll;

  const renderItems = (
    items: MissingOrganizationItem[],
    emptyLabel: string,
  ) => {
    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground text-center">
          {emptyLabel}
        </div>
      );
    }

    return items.map((item) => (
      <div
        key={item.bulstat}
        className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
      >
        <span className="text-sm font-medium text-foreground">{item.name}</span>
        <span className="text-xs text-muted-foreground font-semibold">
          {item.bulstat}
        </span>
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        from="bottom"
        overlayClassName="bg-background/80 backdrop-blur-md"
        className="glass max-w-[min(940px,calc(100%-2rem))] rounded-2xl border border-border p-6 shadow-2xl"
      >
        <div className="flex flex-col gap-5">
          <div className="text-center space-y-2">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("missingOrganizationsModal.title")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("missingOrganizationsModal.description")}
            </DialogDescription>
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("missingOrganizationsModal.newOrganizations")}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {organizations.length}
                </span>
              </div>
              <div className="max-h-42 no-scrollbar overflow-auto space-y-2 pr-1">
                {renderItems(
                  organizations,
                  t("missingOrganizationsModal.noNewOrganizations"),
                )}
              </div>
              <button
                type="button"
                onClick={onSaveOrganizations}
                disabled={isSavingAny || organizations.length === 0}
                className="w-full rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 disabled:hover:cursor-not-allowed hover:cursor-pointer"
              >
                {savingOrganizations || savingAll
                  ? t("missingOrganizationsModal.saving")
                  : t("missingOrganizationsModal.saveOrganizations")}
              </button>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("missingOrganizationsModal.newContragents")}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {contragents.length}
                </span>
              </div>
              <div className="max-h-42 no-scrollbar overflow-auto space-y-2 pr-1">
                {renderItems(
                  contragents,
                  t("missingOrganizationsModal.noNewContragents"),
                )}
              </div>
              <button
                type="button"
                onClick={onSaveContragents}
                disabled={isSavingAny || contragents.length === 0}
                className="w-full rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 disabled:hover:cursor-not-allowed hover:cursor-pointer"
              >
                {savingContragents || savingAll
                  ? t("missingOrganizationsModal.saving")
                  : t("missingOrganizationsModal.saveContragents")}
              </button>
            </div>
          </div>

          <div className="flex lg:flex-row flex-col gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingAny}
              className="w-full rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 hover:cursor-pointer"
            >
              {t("missingOrganizationsModal.cancel")}
            </button>
            <button
              type="button"
              onClick={onSaveAll}
              disabled={isSavingAny}
              className="w-full rounded-lg border border-border bg-primary/90 px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover:cursor-pointer"
            >
              {savingAll && <Loader2 className="w-4 h-4 animate-spin" />}
              {savingAll
                ? t("missingOrganizationsModal.saving")
                : t("missingOrganizationsModal.saveAll")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
