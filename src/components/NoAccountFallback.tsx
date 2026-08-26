"use client";

import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { FadeIn } from "./motion";

export default function NoAccountFallback() {
  const t = useTranslations();
  const router = useRouter();

  return (
    <FadeIn>
      <div className="grid lg:grid-cols-2 lg:gap-0 grid-cols-1 gap-3 justify-between lg:items-start">
        <span className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold mb-4 text-foreground">
            {t("organizations.noAccount.title")}
          </h2>
          <p className="text-muted-foreground mb-6">
            {t("organizations.noAccount.description")}
          </p>
          <Button
            onClick={() => router.push("/dashboard/account")}
            className="w-fit"
          >
            {t("organizations.noAccount.createAccountButton")}
          </Button>
        </span>
      </div>
    </FadeIn>
  );
}
