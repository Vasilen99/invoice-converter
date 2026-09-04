"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/animate-ui/components/radix/dialog";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import type {
  ContragentFormData,
  ContragentLight,
  OrganizationFormData,
  OrganizationLight,
  SearchResult,
} from "../../utility/types";
import { useGlobalStore } from "@/store/global";
import { callApi } from "../../utility/hooks/apiFetch";

const SearchOrganizations = dynamic(
  () => import("./SearchOrganizations").then((mod) => mod.default),
  { ssr: false },
);
const ManualAddOrganization = dynamic(
  () => import("./ManualAddOrganization").then((mod) => mod.default),
  { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────

type OrganizationMode = {
  mode: "organization";
  open: boolean;
  setOpen: (open: boolean) => void;
  onEntityAdded: (item: OrganizationLight) => void;
  onEntityUpdated: (item: OrganizationLight) => void;
  editingItem?: OrganizationLight | null;
  organizations?: never;
};

type ContragentMode = {
  mode: "contragent";
  open: boolean;
  setOpen: (open: boolean) => void;
  organizations: { id: number; name: string }[];
  onEntityAdded: (item: ContragentLight) => void;
  onEntityUpdated: (item: ContragentLight) => void;
  editingItem?: ContragentLight | null;
};

export type EntityManagerDialogProps = OrganizationMode | ContragentMode;

// ─── Default form data factories ──────────────────────────────────────────────

const defaultAddress = {
  country: "",
  region: "",
  district: "",
  municipality: "",
  settlement: "",
  area: "",
  street: "",
  streetNumber: "",
  block: "",
  entrance: "",
  floor: "",
  apartment: "",
  postCode: "",
};

const defaultOrganizationForm = (): OrganizationFormData => ({
  name: "",
  bulstat: "",
  vatNumber: "",
  molName: "",
  email: "",
  invoiceSeriesPrefix: "INV",
  bank: "",
  bic: "",
  iban: "",
  address: { ...defaultAddress },
});

const defaultContragentForm = (): ContragentFormData => ({
  name: "",
  bulstat: "",
  vatNumber: "",
  molName: "",
  email: "",
  organizationId: null,
  address: { ...defaultAddress },
});

// ─── Component ────────────────────────────────────────────────────────────────

export function EntityManagerDialog(props: EntityManagerDialogProps) {
  const { mode, open, setOpen, editingItem } = props;
  const t = useTranslations();
  const { setAlertStatus } = useGlobalStore();
  const isContragent = mode === "contragent";
  const isInitiallyEditing = editingItem != null;

  const [searchMode, setSearchMode] = useState<boolean>(!isInitiallyEditing);
  const [isEditMode, setIsEditMode] = useState<boolean>(isInitiallyEditing);
  const [isFormValid, setIsFormValid] = useState<boolean>(false);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(
    editingItem?.id ?? null,
  );

  // Update state when editingItem changes (e.g., when clicking edit on an organization)
  useEffect(() => {
    const hasEditingItem = editingItem != null;
    setSearchMode(!hasEditingItem);
    setIsEditMode(hasEditingItem);
    setSelectedEntityId(editingItem?.id ?? null);
  }, [editingItem]);
  // ─── Form data (unified; we cast to the correct type at usage) ────────────
  const buildInitialFormData = useCallback(():
    | OrganizationFormData
    | ContragentFormData => {
    if (!editingItem) {
      return isContragent ? defaultContragentForm() : defaultOrganizationForm();
    }

    if (isContragent) {
      const c = editingItem as ContragentLight;
      return {
        name: c.name,
        bulstat: c.bulstat ?? "",
        vatNumber: c.vatNumber ?? "",
        molName: c.molName ?? "",
        email: c.email ?? "",
        organizationId: c.organizationId,
        address: {
          country: c.address?.country ?? "",
          region: "",
          district: c.address?.district ?? "",
          municipality: c.address?.municipality ?? "",
          settlement: c.address?.settlement ?? "",
          area: c.address?.area ?? "",
          street: c.address?.street ?? "",
          streetNumber: c.address?.streetNumber ?? "",
          block: c.address?.block ?? "",
          entrance: c.address?.entrance ?? "",
          floor: c.address?.floor ?? "",
          apartment: c.address?.apartment ?? "",
          postCode: c.address?.postCode ?? "",
        },
      } satisfies ContragentFormData;
    }

    const o = editingItem as OrganizationLight;
    return {
      name: o.name,
      bulstat: o.bulstat ?? "",
      vatNumber: o.vatNumber ?? "",
      molName: o.molName ?? "",
      email: o.email ?? "",
      invoiceSeriesPrefix: o.invoiceSeriesPrefix ?? "INV",
      bank: o.bank ?? "",
      iban: o.iban ?? "",
      bic: o.bic ?? "",
      address: {
        country: o.address?.country ?? "",
        region: "",
        district: o.address?.district ?? "",
        municipality: o.address?.municipality ?? "",
        settlement: o.address?.settlement ?? "",
        area: o.address?.area ?? "",
        street: o.address?.street ?? "",
        streetNumber: o.address?.streetNumber ?? "",
        block: o.address?.block ?? "",
        entrance: o.address?.entrance ?? "",
        floor: o.address?.floor ?? "",
        apartment: o.address?.apartment ?? "",
        postCode: o.address?.postCode ?? "",
      },
    } satisfies OrganizationFormData;
  }, [editingItem, isContragent]);

  const [formData, setFormData] = useState<
    OrganizationFormData | ContragentFormData
  >(buildInitialFormData);

  // Update form data when editingItem changes
  useEffect(() => {
    setFormData(buildInitialFormData());
  }, [editingItem, buildInitialFormData]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setFormData(
      isContragent ? defaultContragentForm() : defaultOrganizationForm(),
    );
    setIsEditMode(false);
    setSearchMode(true);
    setIsFormValid(false);
    setSelectedEntityId(null);
  }, [isContragent]);

  const closeAndReset = useCallback(() => {
    setOpen(false);
    resetForm();
  }, [setOpen, resetForm]);

  // ─── Search handler ───────────────────────────────────────────────────────

  const handleSearchResultSelect = useCallback(
    async (result: SearchResult) => {
      if (isContragent) {
        const contragentForm = formData as ContragentFormData;
        if (!contragentForm.organizationId) {
          setAlertStatus({
            status: "error",
            statusHeader: t(
              "contragentsAlerts.error.organizationRequiredHeader",
            ),
            statusContent: t(
              "contragentsAlerts.error.organizationRequiredMessage",
            ),
          });
          return;
        }

        // Validate result has required fields
        if (!result.name || !result.bulstat) {
          setAlertStatus({
            status: "error",
            statusHeader: t("errorMessagesCommon.serverErrorHeader"),
            statusContent: t("errorMessagesCommon.serverErrorMessage"),
          });
          return;
        }

        const requestBody = {
          name: result.name,
          bulstat: result.bulstat,
          vatNumber: result.vatNumber ?? null,
          address: result.address ?? {},
          molName: result.molName ?? "",
          email: contragentForm.email ?? null,
          organizationId: contragentForm.organizationId,
          rawLookupData: result.rawLookupData,
        };

        const response = await callApi(
          "/contragents/add",
          {
            method: "POST",
            body: JSON.stringify(requestBody),
          },
          true,
        );

        if (response) {
          const orgs = (props as ContragentMode).organizations;
          const organizationName = orgs.find(
            (org) => org.id === contragentForm.organizationId,
          )?.name;

          const newContragent: ContragentLight = {
            id: response.id,
            bulstat: result.bulstat ?? null,
            name: result.name,
            vatNumber: result.vatNumber ?? null,
            molName: result.molName ?? null,
            email: contragentForm.email ?? null,
            organizationId: contragentForm.organizationId!,
            organizationName,
            address: result.address ?? null,
          };

          (props as ContragentMode).onEntityAdded(newContragent);
          closeAndReset();
        }
      } else {
        const response = await callApi(
          "/organizations/add",
          {
            method: "POST",
            body: JSON.stringify({
              bulstat: result.bulstat,
              name: result.name,
              vatNumber: result.vatNumber ?? null,
              address: result.address ?? {},
              molName: result.molName ?? "",
              email: result.email ?? null,
              rawLookupData: result.rawLookupData,
            }),
          },
          true,
        );

        if (response) {
          const newOrg: OrganizationLight = {
            id: response.id,
            bulstat: result.bulstat ?? null,
            name: result.name,
            vatNumber: result.vatNumber ?? null,
            molName: result.molName ?? null,
            email: result.email ?? null,
            invoiceSeriesPrefix: "INV",
            address: result.address ?? null,
          };

          (props as OrganizationMode).onEntityAdded(newOrg);
          closeAndReset();
        }
      }
    },
    [isContragent, formData, props, closeAndReset, t, setAlertStatus],
  );

  // ─── Manual add handler ───────────────────────────────────────────────────

  const handleAddManual = useCallback(async () => {
    if (!isFormValid) {
      setAlertStatus({
        status: "error",
        statusHeader: t(
          isContragent
            ? "contragents.missingFieldsHeader"
            : "organizations.missingFieldsHeader",
        ),
        statusContent: t(
          isContragent
            ? "contragents.missingFieldsMessage"
            : "organizations.missingFieldsMessage",
        ),
      });
      return;
    }

    if (isContragent) {
      const contragentForm = formData as ContragentFormData;
      if (!contragentForm.organizationId) {
        setAlertStatus({
          status: "error",
          statusHeader: t("contragentsAlerts.error.organizationRequiredHeader"),
          statusContent: t(
            "contragentsAlerts.error.organizationRequiredMessage",
          ),
        });
        return;
      }

      const response = await callApi(
        "/contragents/add",
        {
          method: "POST",
          body: JSON.stringify({ ...contragentForm, isManualEntry: true }),
        },
        true,
      );

      if (response) {
        const orgs = (props as ContragentMode).organizations;
        const organizationName = orgs.find(
          (org) => org.id === contragentForm.organizationId,
        )?.name;

        const newContragent: ContragentLight = {
          id: response.id,
          name: contragentForm.name,
          bulstat: contragentForm.bulstat ?? null,
          vatNumber: contragentForm.vatNumber ?? null,
          molName: contragentForm.molName ?? null,
          email: contragentForm.email ?? null,
          organizationId: contragentForm.organizationId!,
          organizationName,
          address: contragentForm.address,
        };

        (props as ContragentMode).onEntityAdded(newContragent);
        closeAndReset();
      }
    } else {
      const orgForm = formData as OrganizationFormData;
      const response = await callApi(
        "/organizations/add",
        {
          method: "POST",
          body: JSON.stringify({ ...orgForm, isManualEntry: true }),
        },
        true,
      );

      if (response) {
        const newOrg: OrganizationLight = {
          id: response.id,
          name: orgForm.name,
          bulstat: orgForm.bulstat ?? null,
          vatNumber: orgForm.vatNumber ?? null,
          molName: orgForm.molName ?? null,
          email: orgForm.email ?? null,
          invoiceSeriesPrefix: orgForm.invoiceSeriesPrefix,
          bank: orgForm.bank ?? null,
          iban: orgForm.iban ?? null,
          bic: orgForm.bic ?? null,
          address: orgForm.address,
        };

        (props as OrganizationMode).onEntityAdded(newOrg);
        closeAndReset();
      }
    }
  }, [
    isFormValid,
    isContragent,
    formData,
    props,
    closeAndReset,
    t,
    setAlertStatus,
  ]);

  // ─── Update handler ───────────────────────────────────────────────────────

  const handleUpdate = useCallback(async () => {
    if (!isFormValid || !selectedEntityId) {
      setAlertStatus({
        status: "error",
        statusHeader: t(
          isContragent
            ? "contragents.missingFieldsHeader"
            : "organizations.missingFieldsHeader",
        ),
        statusContent: t(
          isContragent
            ? "contragents.missingFieldsMessage"
            : "organizations.missingFieldsMessage",
        ),
      });
      return;
    }

    if (isContragent) {
      const contragentForm = formData as ContragentFormData;
      if (!contragentForm.organizationId) {
        setAlertStatus({
          status: "error",
          statusHeader: t("contragentsAlerts.error.organizationRequiredHeader"),
          statusContent: t(
            "contragentsAlerts.error.organizationRequiredMessage",
          ),
        });
        return;
      }

      const response = await callApi(
        "/contragents/update",
        {
          method: "PUT",
          body: JSON.stringify({
            contragentId: selectedEntityId,
            ...contragentForm,
          }),
        },
        true,
      );

      if (response) {
        const orgs = (props as ContragentMode).organizations;
        const organizationName = orgs.find(
          (org) => org.id === contragentForm.organizationId,
        )?.name;

        const updated: ContragentLight = {
          id: selectedEntityId,
          name: contragentForm.name,
          bulstat: contragentForm.bulstat ?? null,
          vatNumber: contragentForm.vatNumber ?? null,
          molName: contragentForm.molName ?? null,
          email: contragentForm.email ?? null,
          organizationId: contragentForm.organizationId!,
          organizationName,
          address: contragentForm.address,
        };

        (props as ContragentMode).onEntityUpdated(updated);
        closeAndReset();
      }
    } else {
      const orgForm = formData as OrganizationFormData;
      const response = await callApi(
        "/organizations/update",
        {
          method: "PUT",
          body: JSON.stringify({
            organizationId: selectedEntityId,
            ...orgForm,
          }),
        },
        true,
      );

      if (response) {
        const updated: OrganizationLight = {
          id: selectedEntityId,
          name: orgForm.name,
          bulstat: orgForm.bulstat ?? null,
          vatNumber: orgForm.vatNumber ?? null,
          molName: orgForm.molName ?? null,
          email: orgForm.email ?? null,
          invoiceSeriesPrefix: orgForm.invoiceSeriesPrefix,
          bank: orgForm.bank ?? null,
          iban: orgForm.iban ?? null,
          bic: orgForm.bic ?? null,
          address: orgForm.address,
        };

        (props as OrganizationMode).onEntityUpdated(updated);
        closeAndReset();
      }
    }
  }, [
    isFormValid,
    selectedEntityId,
    isContragent,
    formData,
    props,
    closeAndReset,
    t,
    setAlertStatus,
  ]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const titleKey = isContragent
    ? isEditMode
      ? "contragents.editContragent"
      : "contragents.addContragent"
    : isEditMode
      ? "organizations.editOrganization"
      : "organizations.addOrganization";

  const descriptionKey = isContragent
    ? isEditMode
      ? "contragents.editContragentDescription"
      : "contragents.addContragentDescription"
    : isEditMode
      ? "organizations.editOrganizationDescription"
      : "organizations.addOrganizationDescription";

  const submitLabel = isEditMode
    ? t(isContragent ? "contragents.update" : "organizations.update")
    : searchMode
      ? t(isContragent ? "contragents.close" : "organizations.close")
      : t(isContragent ? "contragents.add" : "organizations.add");

  const searchSwitchLabelKey = isContragent
    ? "contragents.searchSwitchLabel"
    : "organizations.searchSwitchLabel";
  const manualSwitchLabelKey = isContragent
    ? "contragents.manualAddSwitchLabel"
    : "organizations.manualAddSwitchLabel";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setOpen(false);
      }}
    >
      <DialogContent
        from="bottom"
        overlayClassName="bg-background/60 backdrop-blur-md"
        className="glass max-w-[min(850px,calc(100%-2rem))] rounded-2xl border border-border p-8 shadow-2xl"
      >
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
          }}
          className="flex flex-col gap-5"
        >
          {[
            // ── Header ──────────────────────────────────────────────────────
            <div
              key="head"
              className="flex flex-col items-center gap-2 text-center"
            >
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {t(titleKey)}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t(descriptionKey)}
              </DialogDescription>
            </div>,

            // ── Organization selector (contragent mode only) ─────────────
            isContragent && (
              <div key="organization-select" className="flex flex-col gap-2">
                <Label htmlFor="organization-select">
                  {t("contragents.selectOrganization")}
                </Label>
                <Select
                  value={
                    (
                      formData as ContragentFormData
                    ).organizationId?.toString() ?? ""
                  }
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      organizationId: parseInt(value),
                    }))
                  }
                >
                  <SelectTrigger className="w-full" id="organization-select">
                    <SelectValue
                      className="hover:text-foreground! text-foreground!"
                      placeholder={t(
                        "contragents.selectOrganizationPlaceholder",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-muted">
                    {(props as ContragentMode).organizations.map((org) => (
                      <SelectItem
                        className="cursor-pointer text-foreground"
                        key={org.id}
                        value={org.id.toString()}
                      >
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ),

            // ── Search / Manual switch (add mode only) ───────────────────
            !isEditMode && (
              <div
                key="switch"
                className="flex gap-3 justify-center items-center"
              >
                <Label htmlFor="search-switch">{t(searchSwitchLabelKey)}</Label>
                <Switch
                  checked={searchMode}
                  onCheckedChange={setSearchMode}
                  id="search-switch"
                />
                <Label htmlFor="manual-add-switch">
                  {t(manualSwitchLabelKey)}
                </Label>
              </div>
            ),

            // ── Search or Manual form ────────────────────────────────────
            <div key="input">
              {searchMode && !isEditMode ? (
                <SearchOrganizations
                  onSelectResult={handleSearchResultSelect}
                />
              ) : (
                <ManualAddOrganization
                  translations={t}
                  formData={formData}
                  setFormData={setFormData as any}
                  onValidationChange={setIsFormValid}
                  isContragent={isContragent}
                />
              )}
            </div>,

            // ── Submit / Close button ────────────────────────────────────
            (isEditMode || !searchMode) && (
              <motion.button
                key="submit"
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={isEditMode ? handleUpdate : handleAddManual}
                disabled={!isFormValid}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/50 py-2.5 text-sm font-medium transition-colors hover:bg-muted lg:hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLabel}
              </motion.button>
            ),

            // ── Close button in search mode ──────────────────────────────
            searchMode && !isEditMode && (
              <motion.button
                key="close"
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={closeAndReset}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/50 py-2.5 text-sm font-medium transition-colors hover:bg-muted lg:hover:cursor-pointer"
              >
                {t(isContragent ? "contragents.close" : "organizations.close")}
              </motion.button>
            ),
          ]
            .filter(Boolean)
            .map((node, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                }}
              >
                {node}
              </motion.div>
            ))}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export default EntityManagerDialog;
