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
} from "../../utility/types";
import type { SearchResult } from "@/hooks/use-organization-search";
import { Edit2, Trash2 } from "lucide-react";
import { useGlobalStore } from "@/store/global";

const ManualAddOrganization = dynamic(() => import("./ManualAddOrganization"), {
  ssr: false,
});

const SearchOrganizations = dynamic(() => import("./SearchOrganizations"), {
  ssr: false,
});

interface StoredOrganization extends SearchResult {
  id: number;
}

export default function Organizations({
  organizations,
}: {
  organizations: OrganizationLight[];
}) {
  const t = useTranslations();
  const { setAlertStatus } = useGlobalStore();
  const [organizationsList, setOrganizationsList] =
    useState<StoredOrganization[]>(organizations);
  const [open, setOpen] = useState<boolean>(false);
  const [searchMode, setSearchMode] = useState<boolean>(true);
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

    // Transform search result to API format with comprehensive data including address
    const organizationData = {
      legalName: result.legalName,
      bulstat: result.bulstat,
      vatNumber: result.vatRegistered ? null : null, // Will be filled from registry cache if available
      address: {
        country: result.address?.country || "",
        region: result.address?.region || "",
        district: result.address?.district || result.district || "",
        municipality: result.address?.municipality || "",
        settlement: result.address?.settlement || "",
        area: result.address?.area || "",
        street: result.address?.street || "",
        streetNumber: result.address?.streetNumber || "",
        block: result.address?.block || "",
        entrance: result.address?.entrance || "",
        floor: result.address?.floor || "",
        apartment: result.address?.apartment || "",
        postCode: result.address?.postCode || "",
      },
      molName: result.molName || "", // Use extracted manager name or empty string
      invoiceSeriesPrefix: "INV",
      rawLookupData: result.rawLookupData || result, // Send the full API response for caching
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
        ...result,
        id: response.id, // Use the ID from the API response
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
  };

  const handleAddManualOrganization = () => {
    // TODO: Implement manual organization addition
    console.log("Manual organization data:", manualFormData);
  };
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
        <FadeIn delay={0.02} className="pt-12">
          {organizations.length === 0 ? (
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
                  <div className="flex gap-2 w-full justify-between items-start">
                    <div className="flex flex-col gap-2 flex-1">
                      <span className="font-semibold">{org.legalName}</span>
                      <div className="flex gap-2 flex-wrap">
                        <span className="font-mono text-xs bg-background px-2 py-1 rounded">
                          {org.bulstat}
                        </span>
                        {org.district && (
                          <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                            {org.district}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          // TODO: Implement edit functionality
                          console.log("Edit organization:", org.bulstat);
                        }}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteOrganization(org.id)}
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
      <Dialog
        open={open}
        onOpenChange={(isOpen: boolean) => !isOpen && setOpen(false)}
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
                  {t("organizations.addOrganization")}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {t("organizations.addOrganizationDescription")}
                </DialogDescription>
              </div>,
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
              </div>,
              <div key="input">
                {searchMode ? (
                  <SearchOrganizations
                    onSelectResult={handleSearchResultSelect}
                  />
                ) : (
                  <ManualAddOrganization
                    translations={t}
                    formData={manualFormData}
                    setFormData={setManualFormData}
                  />
                )}
              </div>,

              <motion.button
                key="add"
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={
                  searchMode
                    ? () => setOpen(false)
                    : handleAddManualOrganization
                }
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/50 py-2.5 text-sm font-medium transition-colors hover:bg-muted lg:hover:cursor-pointer"
              >
                {t("organizations.add")}
              </motion.button>,
            ].map((node, i) => (
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
    </>
  );
}
