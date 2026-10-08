export type ParsedLineItem = {
  description?: string;
  unit?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  vatPercent?: string | number;
};

export type ParsedInvoiceData = {
  location?: string;
  bank?: string;
  iban?: string;
  bic?: string;
  lineItems?: ParsedLineItem[];
};

export type LineItemTemplate = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatPercent: string;
};

export type BankInfo = {
  bank: string;
  iban: string;
  bic: string;
};
