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
import { useState, useCallback } from "react";
import type {
  ContragentFormData,
  ContragentLight,
  SearchResult,
} from "../../utility/types";
import { useGlobalStore } from "@/store/global";
import { callApi } from "../../utility/hooks/apiFetch";

const SearchOrganizations = dynamic(
  () => import("./SearchOrganizations").then((mod) => mod.default),
  {
    ssr: false,
  },
);
const ManualAddOrganization = dynamic(
  () => import("./ManualAddOrganization").then((mod) => mod.default),
  {
    ssr: false,
  },
);

type ContragentsManagerProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  organizations: { id: number; legalName: string }[];
  contragents: ContragentLight[];
  setContragents: (contragents: ContragentLight[]) => void;
  isEditMode?: boolean;
  editingContragent?: ContragentLight | null;
};

export const ContragentsManager = ({
  open,
  setOpen,
  organizations,
  contragents,
  setContragents,
  isEditMode: initialEditMode = false,
  editingContragent = null,
}: ContragentsManagerProps) => {
  const t = useTranslations();
  const { setAlertStatus } = useGlobalStore();

  const defaultFormData: ContragentFormData = {
    name: "",
    bulstat: "",
    vatNumber: "",
    molName: "",
    email: "",
    organizationId: null,
    address: {
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
    },
  };

  const [searchMode, setSearchMode] = useState<boolean>(true);
  const [isEditMode, setIsEditMode] = useState<boolean>(initialEditMode);
  const [isFormValid, setIsFormValid] = useState<boolean>(false);
  const [selectedContragentId, setSelectedContragentId] = useState<
    number | null
  >(editingContragent?.id || null);
  const [manualFormData, setManualFormData] =
    useState<ContragentFormData>(defaultFormData);

  const resetForm = useCallback(() => {
    setManualFormData(defaultFormData);
    setIsEditMode(false);
    setSearchMode(true);
    setIsFormValid(false);
    setSelectedContragentId(null);
  }, []);

  const handleSearchResultSelect = useCallback(
    async (result: SearchResult) => {
      if (!manualFormData.organizationId) {
        setAlertStatus({
          status: "error",
          statusHeader: t("contragentsAlerts.error.organizationRequiredHeader"),
          statusContent: t(
            "contragentsAlerts.error.organizationRequiredMessage",
          ),
        });
        return;
      }

      // if (contragents.some((cont) => cont.bulstat === result.bulstat)) {
      //   console.log("here we stop");

      //   setAlertStatus({
      //     status: "info",
      //     statusHeader: t("contragents.alreadyAddedHeader"),
      //     statusContent: t("contragents.alreadyAddedMessage"),
      //   });
      //   return;
      // }

      const contragentData = {
        name: result.legalName,
        bulstat: result.bulstat,
        vatNumber: result.vatNumber || null,
        address: result.address || {},
        molName: result.molName || "",
        email: manualFormData.email || null,
        organizationId: manualFormData.organizationId,
        rawLookupData: result.rawLookupData,
      };

      const response = await callApi(
        "/contragents/add",
        {
          method: "POST",
          body: JSON.stringify(contragentData),
        },
        true,
      );

      if (response) {
        const organizationName = organizations.find(
          (org) => org.id === manualFormData.organizationId,
        )?.legalName;

        const newContragent: ContragentLight = {
          id: response.id,
          bulstat: result.bulstat || null,
          name: result.legalName,
          vatNumber: result.vatNumber || null,
          molName: result.molName || null,
          email: manualFormData.email || null,
          organizationId: manualFormData.organizationId!,
          organizationName,
          address: result.address || null,
        };

        setContragents([...contragents, newContragent]);
        setOpen(false);
        resetForm();
      }
    },
    [
      manualFormData.organizationId,
      manualFormData.email,
      contragents,
      organizations,
      setContragents,
      setOpen,
      resetForm,
      t,
      setAlertStatus,
    ],
  );

  const handleAddManualContragent = useCallback(async () => {
    if (!isFormValid) {
      setAlertStatus({
        status: "error",
        statusHeader: t("contragents.missingFieldsHeader"),
        statusContent: t("contragents.missingFieldsMessage"),
      });
      return;
    }

    if (!manualFormData.organizationId) {
      setAlertStatus({
        status: "error",
        statusHeader: t("contragentsAlerts.error.organizationRequiredHeader"),
        statusContent: t("contragentsAlerts.error.organizationRequiredMessage"),
      });
      return;
    }

    const response = await callApi(
      "/contragents/add",
      {
        method: "POST",
        body: JSON.stringify({
          ...manualFormData,
          isManualEntry: true,
        }),
      },
      true,
    );

    if (response) {
      const organizationName = organizations.find(
        (org) => org.id === manualFormData.organizationId,
      )?.legalName;

      const newContragent: ContragentLight = {
        id: response.id,
        name: manualFormData.name,
        bulstat: manualFormData.bulstat || null,
        vatNumber: manualFormData.vatNumber || null,
        molName: manualFormData.molName || null,
        email: manualFormData.email || null,
        organizationId: manualFormData.organizationId!,
        organizationName,
        address: manualFormData.address,
      };

      setContragents([...contragents, newContragent]);
      setOpen(false);
      resetForm();
    }
  }, [
    isFormValid,
    manualFormData,
    organizations,
    contragents,
    setContragents,
    setOpen,
    resetForm,
    t,
    setAlertStatus,
  ]);

  const handleUpdateContragent = useCallback(async () => {
    if (
      !isFormValid ||
      !selectedContragentId ||
      !manualFormData.organizationId
    ) {
      setAlertStatus({
        status: "error",
        statusHeader: t("contragents.missingFieldsHeader"),
        statusContent: t("contragents.missingFieldsMessage"),
      });
      return;
    }

    const response = await callApi(
      "/contragents/update",
      {
        method: "PUT",
        body: JSON.stringify({
          contragentId: selectedContragentId,
          ...manualFormData,
        }),
      },
      true,
    );

    if (response) {
      const organizationName = organizations.find(
        (org) => org.id === manualFormData.organizationId,
      )?.legalName;

      setContragents(
        contragents.map((cont) =>
          cont.id === selectedContragentId
            ? {
                id: cont.id,
                name: manualFormData.name,
                bulstat: manualFormData.bulstat || null,
                vatNumber: manualFormData.vatNumber || null,
                molName: manualFormData.molName || null,
                email: manualFormData.email || null,
                organizationId: manualFormData.organizationId!,
                organizationName,
                address: manualFormData.address,
              }
            : cont,
        ),
      );
      setOpen(false);
      resetForm();
    }
  }, [
    isFormValid,
    selectedContragentId,
    manualFormData,
    organizations,
    contragents,
    setContragents,
    setOpen,
    resetForm,
    t,
    setAlertStatus,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
          setOpen(false);
          resetForm();
        }
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
            show: {
              transition: { staggerChildren: 0.07, delayChildren: 0.1 },
            },
          }}
          className="flex flex-col gap-5"
        >
          {[
            <div
              key="head"
              className="flex flex-col items-center gap-2 text-center"
            >
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {isEditMode
                  ? t("contragents.editContragent")
                  : t("contragents.addContragent")}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {isEditMode
                  ? t("contragents.editContragentDescription")
                  : t("contragents.addContragentDescription")}
              </DialogDescription>
            </div>,
            <div key="organization-select" className="flex flex-col gap-2">
              <Label htmlFor="organization-select">
                {t("contragents.selectOrganization")}
              </Label>
              <Select
                value={manualFormData.organizationId?.toString() || ""}
                onValueChange={(value) =>
                  setManualFormData((prev: ContragentFormData) => ({
                    ...prev,
                    organizationId: parseInt(value),
                  }))
                }
              >
                <SelectTrigger className="w-full" id="organization-select">
                  <SelectValue
                    className="hover:text-foreground! text-foreground!"
                    placeholder={t("contragents.selectOrganizationPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent className="bg-muted">
                  {organizations.map((org) => (
                    <SelectItem
                      className="cursor-pointer text-foreground"
                      key={org.id}
                      value={org.id.toString()}
                    >
                      {org.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>,
            !isEditMode && (
              <div
                key="switch"
                className="flex gap-3 justify-center items-center"
              >
                <Label htmlFor="search-switch">
                  {t("contragents.searchSwitchLabel")}
                </Label>
                <Switch
                  checked={searchMode}
                  onCheckedChange={setSearchMode}
                  id="search-switch"
                />
                <Label htmlFor="manual-add-switch">
                  {t("contragents.manualAddSwitchLabel")}
                </Label>
              </div>
            ),
            <div key="input">
              {searchMode && !isEditMode ? (
                <SearchOrganizations
                  onSelectResult={handleSearchResultSelect}
                />
              ) : (
                <ManualAddOrganization
                  translations={t}
                  formData={manualFormData}
                  setFormData={setManualFormData}
                  onValidationChange={setIsFormValid}
                  isContragent={true}
                />
              )}
            </div>,

            isEditMode && (
              <motion.button
                key="add"
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={
                  searchMode && !isEditMode
                    ? () => {
                        setOpen(false);
                        resetForm();
                      }
                    : isEditMode
                      ? handleUpdateContragent
                      : handleAddManualContragent
                }
                disabled={!searchMode && !isEditMode && !isFormValid}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/50 py-2.5 text-sm font-medium transition-colors hover:bg-muted lg:hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("contragents.update")}
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
};

// Export both names for backward compatibility
export { ContragentsManager as ContragentsAddEdit };
export { ContragentsManager as ContragentsSearch };

// Export the handler functions too
export type { ContragentsManagerProps };
