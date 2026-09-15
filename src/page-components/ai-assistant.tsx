"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEventHandler,
} from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import type { BulgarianInvoiceData } from "@/types";
import { uploadPdfToSupabase } from "@/utility/pdf-upload";
import { useGlobalStore } from "@/store/global";
import { Bot, Loader2, Plus, Send } from "lucide-react";
import { hasRequiredInvoiceFields } from "@/utility/api-helpers/invoice";
import type { ChatMessage, ChatRole } from "@/utility/types/ai-chat";
import dynamic from "next/dynamic";
import { callApi } from "@/utility/hooks/apiFetch";

const MessageBubble = dynamic(
  () => import("@/components/MessageBubble").then((mod) => mod.MessageBubble),
  {
    ssr: false,
  },
);

const ConfirmationDialog = dynamic(
  () => import("@/components/ConfirmationDialog").then((mod) => mod.default),
  {
    ssr: false,
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccountOrgSnapshot = {
  id: number;
  name: string;
  bulstat: string | null;
  vatNumber: string | null;
  molName: string | null;
  address: unknown;
  bank: string | null;
  iban: string | null;
  bic: string | null;
  invoiceSeriesPrefix: string | null;
  current_inv_number: string | number | null;
  contragents: {
    id: number;
    name: string;
    bulstat: string | null;
    vatNumber: string | null;
    molName: string | null;
    address: unknown;
    organizationId: number;
  }[];
};

export type AccountContext = {
  accountMembers: {
    accountId: number;
    account: {
      creditBalance: number;
      composer_name: string | null;
      organizations: AccountOrgSnapshot[];
    };
  }[];
};

type ChatApiResponse = {
  data: {
    intent: "create_invoice" | "edit_invoice" | "unsupported";
    assistantMessage: string;
    invoice: BulgarianInvoiceData | null;
    status:
      | "ok"
      | "unsupported"
      | "missing-draft"
      | "company-not-found"
      | "invalid-input";
  } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWelcomeMessage(
  t: ReturnType<typeof useTranslations>,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: t("welcome"),
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIAssistantPage({ account }: { account: AccountContext }) {
  const t = useTranslations("aiChat");
  const { setAlertStatus } = useGlobalStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [currentInvoice, setCurrentInvoice] =
    useState<BulgarianInvoiceData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);

  const pendingNavigationRef = useRef<string | null>(null);
  const bypassLeaveGuardRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const accountMember = account.accountMembers[0];
  const accountOrgs = accountMember?.account.organizations ?? [];

  // The latest assistant message that carries an invoice
  const latestInvoiceMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].invoice) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  const hasUnsavedDraft = useMemo(
    () => Boolean(currentInvoice) || messages.some((m) => m.role === "user"),
    [currentInvoice, messages],
  );

  const isInvoiceReadyForSave = useMemo(() => {
    return hasRequiredInvoiceFields(currentInvoice);
  }, [currentInvoice]);

  const canSend = useMemo(
    () => messageInput.trim().length > 0 && !isGenerating,
    [messageInput, isGenerating],
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Init welcome message
  useEffect(() => {
    setMessages([buildWelcomeMessage(t)]);
    setCurrentInvoice(null);
  }, [t]);

  // Leave guard
  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedDraft || bypassLeaveGuardRef.current) return;
      const anchor = (event.target as HTMLElement | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:"))
        return;
      const destination = new URL(href, window.location.origin);
      const current = new URL(window.location.href);
      const sameRoute =
        destination.pathname === current.pathname &&
        destination.search === current.search;
      if (destination.origin !== current.origin || sameRoute) return;
      event.preventDefault();
      event.stopPropagation();
      pendingNavigationRef.current = destination.toString();
      setIsLeaveDialogOpen(true);
    };
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [hasUnsavedDraft]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const resetDraft = () => {
    setMessages([buildWelcomeMessage(t)]);
    setCurrentInvoice(null);
    setMessageInput("");
  };

  const pushMessage = (
    role: ChatRole,
    content: string,
    extra?: Partial<ChatMessage>,
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role,
        content,
        createdAt: new Date().toISOString(),
        ...extra,
      },
    ]);
  };

  const sendMessage = async () => {
    const text = messageInput.trim();
    if (!text || isGenerating) return;

    setMessageInput("");
    pushMessage("user", text);
    setIsGenerating(true);

    try {
      const data = await callApi("/ai-assistant/chat-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          currentInvoice,
          accountOrgs,
        }),
      });

      if (!data) {
        pushMessage("assistant", t("serverProcessingError"));
        return;
      }

      if (data.invoice) {
        setCurrentInvoice(data.invoice);
      }

      const fallbackByStatus: Record<string, string> = {
        unsupported: t("unsupportedPromptFallback"),
        "missing-draft": t("missingDraftFallback"),
        "company-not-found": t("companyNotFoundFallback"),
        "invalid-input": t("invalidInputFallback"),
      };

      const assistantMessage =
        data.status === "company-not-found"
          ? data.assistantMessage || fallbackByStatus[data.status]
          : data.status
            ? fallbackByStatus[data.status] || data.assistantMessage
            : data.assistantMessage || t("serverProcessingError");

      pushMessage("assistant", assistantMessage, {
        invoice: data ? data.invoice : undefined,
      });
    } catch {
      pushMessage("assistant", t("serverProcessingError"));
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAndDownloadInvoice = async () => {
    if (!currentInvoice || isSaving || !isInvoiceReadyForSave) return;

    setIsSaving(true);

    try {
      let generatedPdfBlob: Blob | null = null;
      let generatedPdfUrl: string | null = null;

      try {
        const pdfResponse = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentInvoice),
        });

        if (pdfResponse.ok) {
          generatedPdfBlob = await pdfResponse.blob();
          generatedPdfUrl = await uploadPdfToSupabase(
            generatedPdfBlob,
            currentInvoice.invoiceNumber,
            accountMember?.accountId ?? undefined,
            currentInvoice.sellerEik,
          );

          // Download PDF immediately after successful generation
          const downloadUrl = URL.createObjectURL(generatedPdfBlob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = `faktura-${currentInvoice.invoiceNumber}-${currentInvoice.sellerEik}.pdf`;
          document.body.appendChild(link);

          // Temporarily bypass leave guard for programmatic download
          bypassLeaveGuardRef.current = true;
          link.click();
          bypassLeaveGuardRef.current = false;

          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
        }
      } catch (pdfError) {
        console.warn("[ai-assistant] PDF generation failed:", pdfError);
        setAlertStatus({
          status: "error",
          statusHeader: t("pdfGenerationErrorHeader"),
          statusContent: t("pdfGenerationErrorMessage"),
        });
      }

      const recordResponse = await callApi(
        "/record-invoice",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceData: currentInvoice,
            generatedPdfUrl,
            skipSourceDocumentCreation: true,
          }),
        },
        true,
      );

      if (!recordResponse) {
        setAlertStatus({
          status: "error",
          statusHeader: t("invoiceSaveFailedHeader"),
          statusContent: t("invoiceSaveFailed"),
        });
        return;
      }

      const successMessage = generatedPdfBlob
        ? t("invoiceSavedAndDownloaded")
        : t("invoiceSavedNoPdf");
      setAlertStatus({
        status: "success",
        statusHeader: t("invoiceSavedHeader"),
        statusContent: successMessage,
      });
    } catch {
      setAlertStatus({
        status: "error",
        statusHeader: t("invoiceSaveFailedHeader"),
        statusContent: t("invoiceSaveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onConfirmLeave = () => {
    const destination = pendingNavigationRef.current;
    resetDraft();
    bypassLeaveGuardRef.current = true;
    if (destination) {
      window.location.href = destination;
      return;
    }
    window.history.back();
  };

  const onCancelLeave = () => {
    pendingNavigationRef.current = null;
    setIsLeaveDialogOpen(false);
  };

  const onInputKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetDraft}
          className="gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("newDraft")}
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
        <div className="space-y-6">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLatestInvoice={message.id === latestInvoiceMessageId}
              isInvoiceReadyForSave={isInvoiceReadyForSave}
              isSaving={isSaving}
              onSaveAndDownload={saveAndDownloadInvoice}
              t={t}
            />
          ))}

          {isGenerating && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("generating")}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-background pb-2 pt-4">
        <div className="relative">
          <textarea
            id="ai-chat-input"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t("placeholder")}
            rows={3}
            className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 pr-14 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={t("inputLabel")}
          />
          <Button
            onClick={sendMessage}
            disabled={!canSend}
            size="icon"
            className="absolute bottom-3 right-3 h-8 w-8 rounded-xl"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          {t("inputHint")}
        </p>
      </div>

      <ConfirmationDialog
        isOpen={isLeaveDialogOpen}
        onClose={onCancelLeave}
        title={t("leaveDialog.title")}
        description={t("leaveDialog.description")}
        mainActionButtonContent={t("leaveDialog.leave")}
        secondaryActionContent={t("leaveDialog.stay")}
        onMainAction={onConfirmLeave}
        onSecondaryAction={onCancelLeave}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------
