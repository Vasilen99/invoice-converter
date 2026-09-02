"use client";
import { FadeIn } from "@/components/motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { ContragentLight } from "../../utility/types";
import { Edit2, Trash2, FileText, Building2 } from "lucide-react";
import { useGlobalStore } from "@/store/global";
import { callApi } from "../../utility/hooks/apiFetch";
import EntityManagerDialog from "@/components/EntityManagerDialog";
import { HeadingSection } from "@/components/HeadingSection";

const ConfirmationDialog = dynamic(
  () => import("../components/ConfirmationDialog").then((mod) => mod.default),
  { ssr: false },
);

const NoAccountFallback = dynamic(
  () => import("../components/NoAccountFallback"),
  { ssr: false },
);

export default function ContragentsPage({
  contragents,
  organizations,
  hasAccount,
}: {
  contragents: ContragentLight[];
  organizations: { id: number; name: string }[];
  hasAccount?: boolean;
}) {
  const t = useTranslations();
  const { setAlertStatus } = useGlobalStore();
  const [contragentsList, setContragentsList] =
    useState<ContragentLight[]>(contragents);
  const [open, setOpen] = useState<boolean>(false);
  const [contragentToDelete, setContragentToDelete] = useState<number | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [editingContragent, setEditingContragent] =
    useState<ContragentLight | null>(null);

  const handleDeleteContragent = async (id: number) => {
    if (!id) return;
    const deleted = await callApi(
      `/contragents/delete`,
      { method: "DELETE", body: JSON.stringify({ contragentId: id }) },
      true,
    );

    if (!deleted) {
      setAlertStatus({
        status: "error",
        statusHeader: t("contragents.deleteErrorHeader"),
        statusContent: t("contragents.deleteErrorMessage"),
      });
      return;
    }
    setContragentsList((prev) => prev.filter((cont) => cont.id !== id));
  };

  const handleEditContragent = (cont: ContragentLight) => {
    setEditingContragent(cont);
    setOpen(true);
  };

  if (!hasAccount) {
    return <NoAccountFallback />;
  }

  return (
    <>
      <div className="text-2xl">
        <FadeIn delay={0.01}>
          <div className="grid lg:grid-cols-2 lg:gap-0 grid-cols-1 gap-3 justify-between lg:items-start">
            <HeadingSection
              title={t("contragents.contragentsHeader")}
              subtitle={t("contragents.contragentsSubheader")}
            />
            <Button
              onClick={() => {
                setEditingContragent(null);
                setOpen(true);
              }}
              className="w-fit lg:ml-auto"
            >
              {t("organizations.addOrganization")}
            </Button>
          </div>
        </FadeIn>
        <FadeIn delay={0.02} className="pb-12 overflow-auto no-scrollbar">
          {contragentsList.length === 0 ? (
            <p className="text-base text-primary/50">
              {t("contragents.noContragents")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {contragentsList.map((cont) => (
                <motion.div
                  key={`${cont.id}-${cont.organizationId}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-2 items-start p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex lg:flex-row flex-col gap-2 lg:w-full w-fit justify-between lg:items-start items-center">
                    <div className="flex lg:flex-row flex-col gap-2 flex-1 lg:items-center items-start">
                      <span className="font-semibold">{cont.name}</span>
                      {cont.bulstat && (
                        <span className="text-sm bg-foreground text-primary-foreground font-semibold px-2 py-1 rounded">
                          {cont.bulstat}
                        </span>
                      )}
                      {cont.organizationName && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 size={14} />
                          <span>{cont.organizationName}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex lg:gap-2 gap-4">
                      {/* TODO: create invoice – disabled for now */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled
                        title={t("contragents.createInvoiceDisabled")}
                      >
                        <FileText size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditContragent(cont)}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setContragentToDelete(cont.id);
                          setIsDeleteDialogOpen(true);
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
        mode="contragent"
        open={open}
        setOpen={setOpen}
        organizations={organizations}
        editingItem={editingContragent}
        onEntityAdded={(item) => setContragentsList((prev) => [...prev, item])}
        onEntityUpdated={(updated) =>
          setContragentsList((prev) =>
            prev.map((cont) => (cont.id === updated.id ? updated : cont)),
          )
        }
      />

      {isDeleteDialogOpen && contragentToDelete !== null && (
        <ConfirmationDialog
          title={t("contragents.confirmDeletionHeader")}
          description={t("contragents.confirmDeletionDescription")}
          onMainAction={() => handleDeleteContragent(contragentToDelete)}
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          mainActionButtonContent={t("contragents.confirmDeletionMainAction")}
        />
      )}
    </>
  );
}
