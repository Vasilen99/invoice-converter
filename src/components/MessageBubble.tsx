"use client";

import type { ChatMessage } from "@/utility/types/ai-chat";
import { User, Bot, Loader2, Download } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

const BulgarianInvoice = dynamic(
  () => import("@/components/BulgarianInvoice").then((mod) => mod.default),
  {
    ssr: false,
  },
);
type MessageBubbleProps = {
  message: ChatMessage;
  isLatestInvoice: boolean;
  isInvoiceReadyForSave: boolean;
  isSaving: boolean;
  onSaveAndDownload: () => void;
  t: ReturnType<typeof import("next-intl").useTranslations>;
};

export function MessageBubble({
  message,
  isLatestInvoice,
  isInvoiceReadyForSave,
  isSaving,
  onSaveAndDownload,
  t,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {/* Text */}
        <div className="inline-block rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-foreground">
          {message.content}
        </div>

        {/* Inline invoice preview */}
        {message.invoice && (
          <div className="space-y-3">
            <div className="w-full overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
              {/* CSS zoom shrinks both visuals AND layout space — no overflow, no empty whitespace */}
              <div
                style={{
                  zoom: 0.5,
                }}
                className="pointer-events-none"
              >
                <BulgarianInvoice data={message.invoice} />
              </div>
            </div>

            {/* Save & download — only on the latest invoice message */}
            {isLatestInvoice && (
              <div className="flex flex-wrap items-center gap-2">
                {!isInvoiceReadyForSave && (
                  <p className="w-full text-xs text-amber-600 dark:text-amber-400">
                    {t("missingPartiesForSave")}
                  </p>
                )}
                <Button
                  onClick={onSaveAndDownload}
                  disabled={!isInvoiceReadyForSave || isSaving}
                  size="sm"
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {isSaving ? t("savingInvoice") : t("saveAndDownload")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
