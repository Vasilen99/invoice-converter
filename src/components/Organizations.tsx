"use client";
import { FadeIn } from "./motion";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import { callApi } from "../../utility/hooks/apiFetch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/animate-ui/components/radix/dialog";
import { useState } from "react";
import { motion } from "framer-motion";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import dynamic from "next/dynamic";
import type {
  OrganizationFormData,
  OrganizationLight,
  SearchResult,
} from "../../utility/types";
import { Edit2, Trash2 } from "lucide-react";
import { useGlobalStore } from "@/store/global";

const ConfirmationDialog = dynamic(() => import("./ConfirmationDialog"), {
  ssr: false,
});
const ManualAddOrganization = dynamic(() => import("./ManualAddOrganization"), {
  ssr: false,
});

const SearchOrganizations = dynamic(() => import("./SearchOrganizations"), {
  ssr: false,
});

const NoAccountFallback = dynamic(() => import("./NoAccountFallback"), {
  ssr: false,
});

interface StoredOrganization extends OrganizationLight {
  // Extends OrganizationLight which already has all needed fields
}

export default function Organizations({
  organizations,
  hasAccount,
}: {
  organizations: OrganizationLight[];
  hasAccount?: boolean;
}) {
  const t = useTranslations();
  const { setAlertStatus } = useGlobalStore();
  const [organizationsList, setOrganizationsList] =
    useState<StoredOrganization[]>(organizations);
  const [open, setOpen] = useState<boolean>(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    number | null
  >(null);
  const [openConfirmationDialog, setOpenConfirmationDialog] =
    useState<boolean>(false);
  const [searchMode, setSearchMode] = useState<boolean>(true);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isFormValid, setIsFormValid] = useState<boolean>(false);
  const [manualFormData, setManualFormData] = useState<OrganizationFormData>({
    legalName: "",
    bulstat: "",
    vatNumber: "",
    molName: "",
    invoiceSeriesPrefix: "INV",
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
  });

  const resetForm = () => {
    setManualFormData({
      legalName: "",
      bulstat: "",
      vatNumber: "",
      molName: "",
      invoiceSeriesPrefix: "INV",
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
    });
    setIsEditMode(false);
    setSearchMode(true);
    setIsFormValid(false);
  };

  const handleSearchResultSelect = async (result: SearchResult) => {
    // Check if already added
    if (organizationsList.some((org) => org.bulstat === result.bulstat)) {
      setAlertStatus({
        status: "info",
        statusHeader: t("organizations.alreadyAddedHeader"),
        statusContent: t("organizations.alreadyAddedMessage"),
      });
      return;
    }

    // Prepare organization data from search result
    const organizationData = {
      bulstat: result.bulstat,
      legalName: result.legalName,
      vatNumber: result.vatNumber || null,
      address: result.address || {},
      molName: result.molName || "",
      rawLookupData: result.rawLookupData,
    };

    const response = await callApi(
      "/organizations/add",
      {
        method: "POST",
        body: JSON.stringify(organizationData),
      },
      true,
    );

    if (response) {
      const newOrganization: StoredOrganization = {
        id: response.id,
        bulstat: result.bulstat || null,
        legalName: result.legalName,
        vatNumber: result.vatNumber || null,
        molName: result.molName || null,
        invoiceSeriesPrefix: "INV",
        address: result.address || null,
      };

      setOrganizationsList((prev) => [...prev, newOrganization]);
      setOpen(false); // Close the dialog after adding
    }
  };

  const handleDeleteOrganization = async (id: number) => {
    if (!id) return;
    const deletedOrganization = await callApi(
      `/organizations/delete`,
      {
        method: "DELETE",
        body: JSON.stringify({ organizationId: id }),
      },
      true,
    );

    if (!deletedOrganization) {
      setAlertStatus({
        status: "error",
        statusHeader: t("organizations.deleteErrorHeader"),
        statusContent: t("organizations.deleteErrorMessage"),
      });
      return;
    }
    setOrganizationsList((prev) => prev.filter((org) => org.id !== id));
    setSelectedOrganizationId(null);
  };

  const handleAddManualOrganization = async () => {
    // Validation is already done in real-time via onValidationChange
    if (!isFormValid) {
      setAlertStatus({
        status: "error",
        statusHeader: t("organizations.missingFieldsHeader"),
        statusContent: t("organizations.missingFieldsMessage"),
      });
      return;
    }

    const response = await callApi(
      "/organizations/add",
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
      const newOrganization: StoredOrganization = {
        id: response.id,
        legalName: manualFormData.legalName,
        bulstat: manualFormData.bulstat || null,
        vatNumber: manualFormData.vatNumber || null,
        molName: manualFormData.molName || null,
        invoiceSeriesPrefix: manualFormData.invoiceSeriesPrefix,
        address: manualFormData.address,
      };

      setOrganizationsList((prev) => [...prev, newOrganization]);
      setOpen(false);
      resetForm();
    }
  };

  const handleEditOrganization = (org: StoredOrganization) => {
    setIsEditMode(true);
    setSearchMode(false);
    setSelectedOrganizationId(org.id);
    setManualFormData({
      legalName: org.legalName,
      bulstat: org.bulstat || "",
      vatNumber: org.vatNumber || "",
      molName: org.molName || "",
      invoiceSeriesPrefix: org.invoiceSeriesPrefix || "INV",
      address: {
        country: org.address?.country || "",
        region: "",
        district: org.address?.district || "",
        municipality: org.address?.municipality || "",
        settlement: org.address?.settlement || "",
        area: org.address?.area || "",
        street: org.address?.street || "",
        streetNumber: org.address?.streetNumber || "",
        block: org.address?.block || "",
        entrance: org.address?.entrance || "",
        floor: org.address?.floor || "",
        apartment: org.address?.apartment || "",
        postCode: org.address?.postCode || "",
      },
    });
    setOpen(true);
  };

  const handleUpdateOrganization = async () => {
    if (!isFormValid || !selectedOrganizationId) {
      setAlertStatus({
        status: "error",
        statusHeader: t("organizations.missingFieldsHeader"),
        statusContent: t("organizations.missingFieldsMessage"),
      });
      return;
    }

    const response = await callApi(
      "/organizations/update",
      {
        method: "PUT",
        body: JSON.stringify({
          organizationId: selectedOrganizationId,
          ...manualFormData,
        }),
      },
      true,
    );

    if (response) {
      setOrganizationsList((prev) =>
        prev.map((org) =>
          org.id === selectedOrganizationId
            ? {
                id: org.id,
                legalName: manualFormData.legalName,
                bulstat: manualFormData.bulstat || null,
                vatNumber: manualFormData.vatNumber || null,
                molName: manualFormData.molName || null,
                invoiceSeriesPrefix: manualFormData.invoiceSeriesPrefix,
                address: manualFormData.address,
              }
            : org,
        ),
      );
      setOpen(false);
      resetForm();
    }
  };

  if (!hasAccount) {
    return <NoAccountFallback />;
  }

  return (
    <>
      <div className="text-2xl">
        <FadeIn delay={0.01}>
          <div className="grid lg:grid-cols-2 lg:gap-0 grid-cols-1 gap-3 justify-between lg:items-start">
            <span className="flex flex-col gap-2">
              <h1 className="flex items-center gap-2 text-primary text-2xl font-bold">
                {t("organizations.organizationsHeader")}
              </h1>
              <p className="text-base">
                {t("organizations.organizationsSubheader")}
              </p>
            </span>
            <Button
              onClick={() => setOpen((prev) => !prev)}
              className="w-fit lg:ml-auto"
            >
              {t("organizations.addOrganization")}
            </Button>
          </div>
        </FadeIn>
        <FadeIn delay={0.02} className="py-12 overflow-auto no-scrollbar">
          {organizationsList.length === 0 ? (
            <p className="text-base text-primary/50">
              {t("organizations.noOrganizations")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {organizationsList.map((org) => (
                <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-2 items-start p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex lg:flex-row flex-col gap-2 lg:w-full w-fit justify-between lg:items-start items-center">
                    <div className="flex lg:flex-row flex-col gap-2 flex-1 lg:items-center items-start">
                      <span className="font-semibold">{org.legalName}</span>
                      <span className="text-sm bg-foreground text-primary-foreground font-semibold px-2 py-1 rounded">
                        {org.bulstat}
                      </span>
                    </div>
                    <div className="flex lg:gap-2 gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditOrganization(org)}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setOpenConfirmationDialog(true);
                          setSelectedOrganizationId(org.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </FadeIn>
      </div>
      {open && (
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
                      ? t("organizations.editOrganization")
                      : t("organizations.addOrganization")}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {isEditMode
                      ? t("organizations.editOrganizationDescription")
                      : t("organizations.addOrganizationDescription")}
                  </DialogDescription>
                </div>,
                !isEditMode && (
                  <div
                    key="switch"
                    className="flex gap-3 justify-center items-center"
                  >
                    <Label htmlFor="search-switch">
                      {t("organizations.searchSwitchLabel")}
                    </Label>
                    <Switch
                      checked={searchMode}
                      onCheckedChange={setSearchMode}
                      id="search-switch"
                    />
                    <Label htmlFor="manual-add-switch">
                      {t("organizations.manualAddSwitchLabel")}
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
                    />
                  )}
                </div>,

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
                        ? handleUpdateOrganization
                        : handleAddManualOrganization
                  }
                  disabled={!searchMode && !isEditMode && !isFormValid}
                  className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/50 py-2.5 text-sm font-medium transition-colors hover:bg-muted lg:hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditMode
                    ? t("organizations.update")
                    : searchMode
                      ? t("organizations.close")
                      : t("organizations.add")}
                </motion.button>,
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
      )}

      {openConfirmationDialog && (
        <ConfirmationDialog
          title={t("organizations.confirmDeletionHeader")}
          description={t("organizations.confirmDeletionDescription")}
          isOpen={openConfirmationDialog}
          onClose={() => setOpenConfirmationDialog(false)}
          mainActionButtonContent={t("organizations.confirmDeletionMainAction")}
          onMainAction={() =>
            handleDeleteOrganization(selectedOrganizationId ?? 0)
          }
        />
      )}
    </>
  );
}
