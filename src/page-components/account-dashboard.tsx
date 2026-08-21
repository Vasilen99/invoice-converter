"use client";
import { Input } from "@/components/ui/input";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import React, { useState, useEffect } from "react";
import { ArrowRightIcon } from "lucide-react";
import { callApi } from "../../utility/hooks/apiFetch";
import { globalStore } from "@/store/global";
interface AccountData {
  id: number;
  name: string;
  creditBalance: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface AccountDashboardPageProps {
  initialData: AccountData | null;
}

export default function AccountDashboardPage({
  initialData,
}: AccountDashboardPageProps) {
  const t = useTranslations();
  const [accountName, setAccountName] = useState<string>("");
  const [accountData, setAccountData] = useState<AccountData | null>(
    initialData || null,
  );
  const { setAlertStatus, isLoading } = globalStore();
  useEffect(() => {
    if (initialData) {
      setAccountName(initialData.name || "");
      setAccountData(initialData);
    }
  }, [initialData]);

  const handleAccountNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountName(e.target.value);
  };

  const handleSaveChanges = async () => {
    if (!accountName.trim()) {
      setAlertStatus({
        status: "error",
        statusHeader: `${t("errorMessages.accountNameRequired")}`,
      });
      return;
    }

    try {
      const accountData = await callApi("/account/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountName: accountName.trim() }),
      });
      if (accountData) {
        setAccountData(accountData);
      }
    } catch (err) {
      console.error("Error saving account:", err);
      setAlertStatus({
        status: "error",
        statusHeader: "Save Error",
        statusContent: "Failed to save account changes",
      });
    }
  };

  const formatDate = (dateString: string | Date) => {
    return new Intl.DateTimeFormat("en-GB", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).format(new Date(dateString));
  };

  return (
    <main className="bg-background h-full w-full pt-12 px-4">
      <div className="flex flex-col gap-6">
        <FadeIn delay={0.01}>
          <h1 className="flex items-center gap-2 text-primary text-2xl font-bold">
            {t("account.accountHeader")}
          </h1>
          <p className="text-base">{t("account.accountSubheader")}</p>
        </FadeIn>
        <FadeIn delay={0.02}>
          <div className="flex flex-col w-fit gap-6">
            <div className="grid lg:grid-cols-2 lg:grid-rows-2 grid-cols-1 gap-8">
              <div className="flex flex-col gap-2 items-start">
                <Label className="text-base text-muted-foreground">
                  {t("account.accountName")}
                </Label>
                <Input
                  value={accountName}
                  onChange={handleAccountNameChange}
                  placeholder={t("account.accountNamePlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2 items-start">
                <Label className="text-base text-muted-foreground">
                  {t("account.creditBalance")}
                </Label>
                <Label className="text-base text-muted-foreground">
                  {accountData?.creditBalance ?? 0}
                </Label>
                <Button className="flex gap-3">
                  {t("account.addCredits")}{" "}
                  <ArrowRightIcon
                    size={12}
                    className="stroke-primary-foreground"
                  />{" "}
                </Button>
              </div>
              <div className="flex flex-col gap-2 items-start">
                <Label className="text-base text-muted-foreground">
                  {t("account.createdAt")}
                </Label>
                <Label className="text-base text-muted-foreground">
                  {accountData?.createdAt
                    ? formatDate(accountData.createdAt)
                    : "-"}
                </Label>
              </div>
              <div className="flex flex-col gap-2 items-start">
                <Label className="text-base text-muted-foreground">
                  {t("account.lastUpdatedAt")}
                </Label>
                <Label className="text-base text-muted-foreground">
                  {accountData?.updatedAt
                    ? formatDate(accountData.updatedAt)
                    : "-"}
                </Label>
              </div>
            </div>
            <Button
              onClick={handleSaveChanges}
              disabled={isLoading}
              className="w-fit"
            >
              {isLoading ? t("account.saving") : t("account.saveChanges")}
            </Button>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
