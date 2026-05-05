// This file exports TypeScript types and interfaces used throughout the application, providing type safety.

export interface InvoiceLineItem {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  total: number | string;
}

export interface ExtractedInvoiceData {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerEmail?: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerEmail?: string;
  lineItems?: InvoiceLineItem[];
  subtotal?: string;
  tax?: string;
  total?: string;
  currency?: string;
  notes?: string;
}

export interface BulgarianInvoiceData {
  // Invoice meta
  invoiceNumber: string;
  invoiceDate: string;
  taxEventDate: string;
  location: string;
  // Seller (Доставчик) — editable defaults
  sellerName: string;
  sellerEik: string;
  sellerVatNumber: string;
  sellerCity: string;
  sellerAddress: string;
  sellerMol: string;
  // Buyer (Получател) — filled from Stripe extraction
  buyerName: string;
  buyerEik: string;
  buyerVatNumber: string;
  buyerCity: string;
  buyerAddress: string;
  buyerMol: string;
  // Line items
  lineItems: {
    description: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    vatPercent: string;
    value: string;
  }[];
  // Totals
  subtotal: string;
  vatAmount: string;
  total: string;
  totalInWords: string;
  currency: string;
}
