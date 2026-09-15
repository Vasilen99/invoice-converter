import type { BulgarianInvoiceData } from "@/types";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  invoice?: BulgarianInvoiceData | null;
};
