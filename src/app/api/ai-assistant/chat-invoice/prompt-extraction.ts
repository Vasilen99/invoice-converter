import { EXTRACT_FROM_PROMPT } from "@/utility/constants";
import { normalizeEik, normalizeText } from "@/utility/helpers/common";
import type { BulgarianInvoiceData } from "@/types";

export type Intent =
  | "create_invoice"
  | "edit_invoice"
  | "use_latest_invoice_template"
  | "unsupported";

export type PromptExtraction = {
  intent: Intent;
  organizationName: string;
  organizationEik: string;
  contragentName: string;
  contragentEik: string;
  invoicePatch: Partial<BulgarianInvoiceData> & {
    lineItems?: BulgarianInvoiceData["lineItems"];
  };
  chatResponse: string;
};

function parseJSON(jsonString: string): { success: boolean; data?: unknown } {
  try {
    return { success: true, data: JSON.parse(jsonString) };
  } catch {
    return { success: false };
  }
}

function extractJsonFromText(text: string): string | null {
  return text.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

function normalizeIntent(rawIntent: unknown): Intent {
  const value = normalizeText(rawIntent);

  if (value === "create_invoice" || value === "edit_invoice") {
    return value;
  }

  if (
    value === "use_latest_invoice_template" ||
    value === "template_invoice" ||
    value === "create_from_latest_invoice"
  ) {
    return "use_latest_invoice_template";
  }

  return "unsupported";
}

export async function extractPromptData(
  prompt: string,
  currentInvoice: BulgarianInvoiceData | null,
): Promise<PromptExtraction> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.responses.create({
    model: "gpt-5.6-luna",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: EXTRACT_FROM_PROMPT },
          { type: "input_text", text: `User prompt: ${prompt}` },
          {
            type: "input_text",
            text: `Current invoice draft JSON: ${currentInvoice ? JSON.stringify(currentInvoice) : "null"}`,
          },
        ],
      },
    ],
  });

  const content = response.output_text ?? "";
  const jsonString = extractJsonFromText(content);

  const fallback: PromptExtraction = {
    intent: "unsupported",
    organizationName: "",
    organizationEik: "",
    contragentName: "",
    contragentEik: "",
    invoicePatch: {},
    chatResponse:
      "I couldn't process that as invoice-related. Please ask me to create or edit an invoice.",
  };

  if (!jsonString) return fallback;

  const parsed = parseJSON(jsonString);
  if (!parsed.success || !parsed.data || typeof parsed.data !== "object") {
    return fallback;
  }

  const data = parsed.data as Record<string, unknown>;

  return {
    intent: normalizeIntent(data.intent),
    organizationName: normalizeText(data.organizationName),
    organizationEik: normalizeEik(data.organizationEik),
    contragentName: normalizeText(data.contragentName),
    contragentEik: normalizeEik(data.contragentEik),
    invoicePatch: ((data.invoicePatch as Record<string, unknown>) ??
      {}) as Partial<BulgarianInvoiceData>,
    chatResponse: normalizeText(data.chatResponse),
  };
}
