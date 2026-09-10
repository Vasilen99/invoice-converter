"use client";

import { useEffect, useMemo, useState, type KeyboardEventHandler } from "react";
import { HeadingSection } from "@/components/HeadingSection";
import { BulgarianInvoice } from "@/components";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";
import { BulgarianInvoiceData } from "@/types";
import { getTodayForInput } from "../../utility/date-formatter";
import {
  Bot,
  Download,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Send,
  User,
  WandSparkles,
} from "lucide-react";

type AccountContext = {
  id: number;
  creditBalance?: number | null;
  composer_name?: string | null;
} | null;

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ResolvedAddress = {
  settlement?: string;
  street?: string;
};

type ResolvedCompany = {
  name: string;
  bulstat: string;
  vatNumber: string | null;
  molName: string | null;
  address?: ResolvedAddress;
  source: "DB" | "CACHE" | "EXTERNAL";
};

type ResolveCompaniesResponse = {
  data: {
    organization: ResolvedCompany | null;
    contragent: ResolvedCompany | null;
    missingEikFor: Array<"organization" | "contragent">;
    message: string | null;
  } | null;
};

const STORAGE_KEY = "ai-invoice-assistant-session-v1";

const SUGGESTIONS = [
  "Create invoice INV-2026-001 for ABC Corp with consulting service - 1200 BGN",
  "Change invoice number to INV-2026-009",
  "Change the invoice date to 15.09.2026",
  "Add line item: Monthly support - 450 BGN",
];

function toFixedMoney(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function parseDecimal(value: string): number {
  const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateTotals(lineItems: BulgarianInvoiceData["lineItems"]) {
  const subtotal = lineItems.reduce(
    (sum, item) =>
      sum + parseDecimal(item.quantity) * parseDecimal(item.unitPrice),
    0,
  );

  const vatAmount = lineItems.reduce((sum, item) => {
    const itemSubtotal =
      parseDecimal(item.quantity) * parseDecimal(item.unitPrice);
    return sum + itemSubtotal * (parseDecimal(item.vatPercent) / 100);
  }, 0);

  const total = subtotal + vatAmount;

  return {
    subtotal: toFixedMoney(subtotal),
    vatAmount: toFixedMoney(vatAmount),
    total: toFixedMoney(total),
  };
}

function createInitialInvoice(account: AccountContext): BulgarianInvoiceData {
  const today = getTodayForInput();

  const lineItems: BulgarianInvoiceData["lineItems"] = [
    {
      description: "Консултантска услуга",
      unit: "бр.",
      quantity: "1",
      unitPrice: "1000.00",
      vatPercent: "20",
      value: "1000.00",
    },
  ];

  const totals = calculateTotals(lineItems);

  return {
    invoiceNumber: "INV-2026-001",
    invoiceDate: today,
    taxEventDate: today,
    location: "София",
    sellerName: "Вашата организация",
    sellerEik: "",
    sellerVatNumber: "",
    sellerCity: "София",
    sellerAddress: "",
    sellerMol: "",
    buyerName: "ABC Corp",
    buyerEik: "",
    buyerVatNumber: "",
    buyerCity: "София",
    buyerAddress: "",
    buyerMol: "",
    lineItems,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
    totalInWords: "",
    currency: "BGN",
    composer_name: account?.composer_name ?? "",
    bank: "",
    iban: "",
    bic: "",
  };
}

function applyLineItemTotals(lineItems: BulgarianInvoiceData["lineItems"]) {
  return lineItems.map((item) => {
    const value = parseDecimal(item.quantity) * parseDecimal(item.unitPrice);
    return {
      ...item,
      value: toFixedMoney(value),
    };
  });
}

function extractFirstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractCompanyLookupInput(prompt: string): {
  organizationName?: string;
  contragentName?: string;
  organizationEik?: string;
  contragentEik?: string;
} {
  const normalized = prompt.trim();

  const organizationName = extractFirstMatch(normalized, [
    /organization\s*[:\-]?\s*(.+?)(?:\s+buyer\s*[:\-]?|\s+for\s+|\s+with\s+|$)/i,
    /seller\s*[:\-]?\s*(.+?)(?:\s+buyer\s*[:\-]?|\s+for\s+|\s+with\s+|$)/i,
    /from\s+(.+?)\s+(?:to|for|with|buyer|contragent)\b/i,
  ]);

  const contragentName = extractFirstMatch(normalized, [
    /contragent\s*[:\-]?\s*(.+?)(?:\s+with\s+|\s*[-–—]\s*\d|$)/i,
    /buyer\s*[:\-]?\s*(.+?)(?:\s+with\s+|\s*[-–—]\s*\d|$)/i,
    /for\s+(.+?)(?:\s+with\s+|\s*[-–—]\s*\d|$)/i,
    /to\s+(.+?)(?:\s+with\s+|\s*[-–—]\s*\d|$)/i,
  ]);

  const organizationEik = extractFirstMatch(normalized, [
    /organization\s+eik\s*[:\-]?\s*(\d{9,13})/i,
    /seller\s+eik\s*[:\-]?\s*(\d{9,13})/i,
  ]);

  const contragentEik = extractFirstMatch(normalized, [
    /contragent\s+eik\s*[:\-]?\s*(\d{9,13})/i,
    /buyer\s+eik\s*[:\-]?\s*(\d{9,13})/i,
  ]);

  const genericEiks = Array.from(normalized.matchAll(/\b\d{9,13}\b/g)).map(
    (match) => match[0],
  );

  return {
    organizationName: organizationName || undefined,
    contragentName: contragentName || undefined,
    organizationEik:
      organizationEik || (genericEiks.length > 0 ? genericEiks[0] : undefined),
    contragentEik:
      contragentEik || (genericEiks.length > 1 ? genericEiks[1] : undefined),
  };
}

async function resolveCompaniesForInvoice(prompt: string) {
  const lookupInput = extractCompanyLookupInput(prompt);

  if (
    !lookupInput.organizationName &&
    !lookupInput.contragentName &&
    !lookupInput.organizationEik &&
    !lookupInput.contragentEik
  ) {
    return null;
  }

  try {
    const response = await fetch("/api/ai-assistant/resolve-companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lookupInput),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ResolveCompaniesResponse;
    return payload.data;
  } catch {
    return null;
  }
}

async function createInvoiceFromPrompt(
  prompt: string,
  account: AccountContext,
): Promise<{
  invoice: BulgarianInvoiceData;
  response: string;
  changedFields: string[];
}> {
  const invoice = createInitialInvoice(account);
  const changedFields: string[] = [];
  const normalized = prompt.trim();

  const invoiceNumberMatch = normalized.match(
    /\b([A-Z]{2,6}-\d{2,6}(?:-\d{1,6})?)\b/i,
  );
  if (invoiceNumberMatch) {
    invoice.invoiceNumber = invoiceNumberMatch[1].toUpperCase();
    changedFields.push("invoiceNumber");
  }

  const buyerMatch = normalized.match(/for\s+(.+?)(?:\s+with|\s*-\s*\d|$)/i);
  if (buyerMatch) {
    invoice.buyerName = buyerMatch[1].trim();
    changedFields.push("buyerName");
  }

  const amountMatch = normalized.match(/(\d+[\d.,]*)\s*(?:bgn|лв|eur)?/i);
  if (amountMatch) {
    const amount = parseDecimal(amountMatch[1]);
    if (amount > 0) {
      invoice.lineItems[0].unitPrice = toFixedMoney(amount);
      invoice.lineItems[0].value = toFixedMoney(amount);
      changedFields.push("lineItems");
    }
  }

  if (/support/i.test(normalized)) {
    invoice.lineItems[0].description = "Месечна поддръжка";
  }

  if (/software/i.test(normalized)) {
    invoice.lineItems[0].description = "Софтуерна услуга";
  }

  const totals = calculateTotals(invoice.lineItems);
  invoice.subtotal = totals.subtotal;
  invoice.vatAmount = totals.vatAmount;
  invoice.total = totals.total;

  const resolvedCompanies = await resolveCompaniesForInvoice(normalized);

  if (resolvedCompanies?.organization) {
    const organization = resolvedCompanies.organization;
    invoice.sellerName = organization.name;
    invoice.sellerEik = organization.bulstat;
    invoice.sellerVatNumber = organization.vatNumber ?? "";
    invoice.sellerMol = organization.molName ?? "";
    invoice.sellerCity = organization.address?.settlement ?? invoice.sellerCity;
    invoice.sellerAddress = organization.address?.street ?? "";
    changedFields.push(
      "sellerName",
      "sellerEik",
      "sellerVatNumber",
      "sellerMol",
      "sellerCity",
      "sellerAddress",
    );
  }

  if (resolvedCompanies?.contragent) {
    const contragent = resolvedCompanies.contragent;
    invoice.buyerName = contragent.name;
    invoice.buyerEik = contragent.bulstat;
    invoice.buyerVatNumber = contragent.vatNumber ?? "";
    invoice.buyerMol = contragent.molName ?? "";
    invoice.buyerCity = contragent.address?.settlement ?? invoice.buyerCity;
    invoice.buyerAddress = contragent.address?.street ?? "";
    changedFields.push(
      "buyerName",
      "buyerEik",
      "buyerVatNumber",
      "buyerMol",
      "buyerCity",
      "buyerAddress",
    );
  }

  if (resolvedCompanies?.missingEikFor.length) {
    return {
      invoice,
      changedFields: Array.from(new Set(changedFields)),
      response:
        resolvedCompanies.message ??
        "Please write companies EIK's to find them",
    };
  }

  const sourceHints: string[] = [];
  if (resolvedCompanies?.organization) {
    sourceHints.push(
      `organization from ${resolvedCompanies.organization.source}`,
    );
  }
  if (resolvedCompanies?.contragent) {
    sourceHints.push(`contragent from ${resolvedCompanies.contragent.source}`);
  }

  return {
    invoice,
    changedFields: Array.from(new Set(changedFields)),
    response: sourceHints.length
      ? `I created a draft invoice and loaded ${sourceHints.join(" and ")}.`
      : "I created a draft invoice. You can now ask for precise refinements like date, invoice number, buyer, or line items.",
  };
}

function refineInvoice(
  current: BulgarianInvoiceData,
  prompt: string,
): {
  invoice: BulgarianInvoiceData;
  response: string;
  changedFields: string[];
} {
  const updated: BulgarianInvoiceData = {
    ...current,
    lineItems: [...current.lineItems],
  };
  const changedFields: string[] = [];
  const normalized = prompt.trim();

  const numberMatch = normalized.match(
    /invoice\s*number\s*(?:to|as)?\s*([A-Z0-9\/-]+)/i,
  );
  if (numberMatch) {
    updated.invoiceNumber = numberMatch[1].toUpperCase();
    changedFields.push("invoiceNumber");
  }

  const dateMatch = normalized.match(
    /(invoice\s*date|date).*?(\d{1,2}[.-]\d{1,2}[.-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  );
  if (dateMatch) {
    const normalizedDate = dateMatch[2].replace(/\./g, "-");
    updated.invoiceDate = normalizedDate;
    updated.taxEventDate = normalizedDate;
    changedFields.push("invoiceDate", "taxEventDate");
  }

  const addItemMatch = normalized.match(
    /add\s+line\s+item[:\-]?\s*(.+?)\s*-\s*(\d+[\d.,]*)\s*(?:bgn|лв|eur)?/i,
  );
  if (addItemMatch) {
    const description = addItemMatch[1].trim();
    const amount = parseDecimal(addItemMatch[2]);

    if (description && amount > 0) {
      updated.lineItems = [
        ...updated.lineItems,
        {
          description,
          unit: "бр.",
          quantity: "1",
          unitPrice: toFixedMoney(amount),
          vatPercent: "20",
          value: toFixedMoney(amount),
        },
      ];
      changedFields.push("lineItems");
    }
  }

  const buyerMatch = normalized.match(/change\s+buyer\s+to\s+(.+)/i);
  if (buyerMatch) {
    updated.buyerName = buyerMatch[1].trim();
    changedFields.push("buyerName");
  }

  updated.lineItems = applyLineItemTotals(updated.lineItems);
  const totals = calculateTotals(updated.lineItems);
  updated.subtotal = totals.subtotal;
  updated.vatAmount = totals.vatAmount;
  updated.total = totals.total;

  if (!changedFields.length) {
    return {
      invoice: current,
      changedFields,
      response:
        "I did not detect a specific editable field. Try: ‘Change invoice number to ...’, ‘Change invoice date to ...’, or ‘Add line item: Description - 500 BGN’.",
    };
  }

  return {
    invoice: updated,
    changedFields,
    response: `Done. Updated: ${Array.from(new Set(changedFields)).join(", ")}.`,
  };
}

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

export function AIAssistantPage({ account }: { account: AccountContext }) {
  const t = useTranslations("aiChat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [currentInvoice, setCurrentInvoice] =
    useState<BulgarianInvoiceData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localStatus, setLocalStatus] = useState<string>("");
  const [lastChangedFields, setLastChangedFields] = useState<string[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setMessages([buildWelcomeMessage(t)]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        messages?: ChatMessage[];
        invoice?: BulgarianInvoiceData | null;
      };

      setMessages(
        parsed.messages && parsed.messages.length
          ? parsed.messages
          : [buildWelcomeMessage(t)],
      );
      setCurrentInvoice(parsed.invoice ?? null);
    } catch {
      setMessages([buildWelcomeMessage(t)]);
    }
  }, [t]);

  useEffect(() => {
    if (!messages.length) return;

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages,
        invoice: currentInvoice,
      }),
    );
  }, [messages, currentInvoice]);

  const canSend = useMemo(
    () => messageInput.trim().length > 0 && !isGenerating,
    [messageInput, isGenerating],
  );

  const pushMessage = (role: ChatRole, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role,
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const saveSessionLocally = () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages,
        invoice: currentInvoice,
      }),
    );
    setLocalStatus(t("savedLocally"));
  };

  const clearSession = () => {
    const welcome = buildWelcomeMessage(t);
    setMessages([welcome]);
    setCurrentInvoice(null);
    setMessageInput("");
    setLastChangedFields([]);
    setLocalStatus(t("newDraftCreated"));
  };

  const sendMessage = async () => {
    const text = messageInput.trim();
    if (!text || isGenerating) return;

    setLocalStatus("");
    setMessageInput("");
    pushMessage("user", text);
    setIsGenerating(true);

    await new Promise((resolve) => setTimeout(resolve, 650));

    const result = currentInvoice
      ? refineInvoice(currentInvoice, text)
      : await createInvoiceFromPrompt(text, account);

    setCurrentInvoice(result.invoice);
    setLastChangedFields(result.changedFields);
    pushMessage("assistant", result.response);
    setIsGenerating(false);
  };

  const onInputKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const downloadPdf = async () => {
    if (!currentInvoice) return;

    setLocalStatus("");
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(currentInvoice),
      });

      if (!response.ok) {
        setLocalStatus(t("downloadFailed"));
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `faktura-${currentInvoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setLocalStatus(t("downloadReady"));
    } catch {
      setLocalStatus(t("downloadFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <HeadingSection title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">
                {t("messagesTitle")}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSession}>
              <Plus className="h-4 w-4" />
              {t("newInvoice")}
            </Button>
          </div>

          <div
            className="mb-4 h-[46vh] min-h-85 overflow-y-auto rounded-xl border border-border bg-background p-3"
            aria-live="polite"
          >
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1 text-[11px] opacity-80">
                      {message.role === "user" ? (
                        <>
                          <User className="h-3 w-3" /> {t("you")}
                        </>
                      ) : (
                        <>
                          <Bot className="h-3 w-3" /> {t("assistant")}
                        </>
                      )}
                    </div>
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("generating")}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="xs"
                onClick={() => setMessageInput(suggestion)}
                className="max-w-full truncate"
              >
                <WandSparkles className="h-3 w-3" />
                <span className="truncate">{suggestion}</span>
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="ai-chat-input"
              className="text-sm font-medium text-foreground"
            >
              {t("inputLabel")}
            </label>
            <textarea
              id="ai-chat-input"
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={t("placeholder")}
              rows={4}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={t("inputLabel")}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t("inputHint")}</p>
              <Button onClick={sendMessage} disabled={!canSend}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("send")}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">
              {t("previewTitle")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={saveSessionLocally}
                disabled={!messages.length}
              >
                <Save className="h-4 w-4" />
                {t("saveDraft")}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={downloadPdf}
                disabled={!currentInvoice}
              >
                <Download className="h-4 w-4" />
                {t("downloadPdf")}
              </Button>
            </div>
          </div>

          <Separator className="mb-3" />

          {localStatus && (
            <p className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              {localStatus}
            </p>
          )}

          {!currentInvoice ? (
            <div className="flex h-[56vh] min-h-95 items-center justify-center rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              {t("emptyPreview")}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  {t("invoiceNumber")}:{" "}
                  <span className="font-semibold text-foreground">
                    {currentInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  {t("buyer")}:{" "}
                  <span className="font-semibold text-foreground">
                    {currentInvoice.buyerName}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  {t("total")}:{" "}
                  <span className="font-semibold text-foreground">
                    {currentInvoice.total} {currentInvoice.currency}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  {t("changedFields")}:{" "}
                  <span className="font-semibold text-foreground">
                    {lastChangedFields.length
                      ? lastChangedFields.join(", ")
                      : "-"}
                  </span>
                </div>
              </div>

              <div className="h-[46vh] min-h-85 overflow-auto rounded-xl border border-border bg-zinc-100/60 p-2 dark:bg-zinc-900/40">
                <div
                  className="origin-top-left"
                  style={{ minWidth: 810, transform: "scale(0.72)" }}
                >
                  <BulgarianInvoice data={currentInvoice} />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
