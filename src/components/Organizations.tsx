"use client";
import { FadeIn } from "./motion";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import { callApi } from "../../utility/hooks/apiFetch";
import { useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { OrganizationLight } from "../../utility/types";
import { Edit2, Trash2 } from "lucide-react";
import { useGlobalStore } from "@/store/global";
import EntityManagerDialog from "./EntityManagerDialog";

const ConfirmationDialog = dynamic(() => import("./ConfirmationDialog"), {
  ssr: false,
});

const NoAccountFallback = dynamic(() => import("./NoAccountFallback"), {
  ssr: false,
});

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
    useState<OrganizationLight[]>(organizations);
  const [open, setOpen] = useState<boolean>(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    number | null
  >(null);
  const [openConfirmationDialog, setOpenConfirmationDialog] =
    useState<boolean>(false);
  const [editingOrganization, setEditingOrganization] =
    useState<OrganizationLight | null>(null);

  const handleDeleteOrganization = async (id: number) => {
    if (!id) return;
    const deleted = await callApi(
      `/organizations/delete`,
      {
        method: "DELETE",
        body: JSON.stringify({ organizationId: id }),
      },
      true,
    );

    if (!deleted) {
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

  const handleEditOrganization = (org: OrganizationLight) => {
    setOpen(true);
    setEditingOrganization(org);
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
              onClick={() => {
                setEditingOrganization(null);
                setOpen(true);
              }}
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
                      <span className="font-semibold">{org.name}</span>
                      {org.bulstat && (
                        <span className="text-sm bg-foreground text-primary-foreground font-semibold px-2 py-1 rounded">
                          {org.bulstat}
                        </span>
                      )}
                    </div>
                    <div className="flex lg:gap-2 gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          handleEditOrganization(org);
                        }}
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

      <EntityManagerDialog
        mode="organization"
        open={open}
        setOpen={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setEditingOrganization(null);
          }
        }}
        editingItem={editingOrganization}
        onEntityAdded={(item) =>
          setOrganizationsList((prev) => [...prev, item])
        }
        onEntityUpdated={(updated) =>
          setOrganizationsList((prev) =>
            prev.map((org) => (org.id === updated.id ? updated : org)),
          )
        }
      />

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
