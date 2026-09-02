export type AlertStatus = {
  status: "error" | "success" | "warning" | "info" | "";
  statusHeader: string;
  statusContent?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export interface User {
  id: number;
  email?: string | null;
  registration_date?: Date;
  first_name: string | null;
  last_name: string | null;
  accountName?: string | null;
}

export type OrganizationLight = {
  id: number;
  name: string;
  bulstat: string | null;
  vatNumber: string | null;
  molName: string | null;
  email: string | null;
  invoiceSeriesPrefix: string;
  bank?: string | null;
  iban?: string | null;
  bic?: string | null;
  address: {
    country?: string;
    region?: string;
    district?: string;
    municipality?: string;
    settlement?: string;
    area?: string;
    street?: string;
    streetNumber?: string;
    block?: string;
    entrance?: string;
    floor?: string;
    apartment?: string;
    postCode?: string;
  } | null;
};

export type ContragentLight = {
  id: number;
  name: string;
  bulstat: string | null;
  vatNumber: string | null;
  molName: string | null;
  email: string | null;
  organizationId: number;
  organizationName?: string; // For display purposes
  address: {
    country?: string;
    region?: string;
    district?: string;
    municipality?: string;
    settlement?: string;
    area?: string;
    street?: string;
    streetNumber?: string;
    block?: string;
    entrance?: string;
    floor?: string;
    apartment?: string;
    postCode?: string;
  } | null;
};

export type Organization = {
  id: number;
  name: string;
  bulstat: string;
  vatNumber: string;
  email: string;
  address: {
    country: string;
    region: string;
    district: string;
    municipality: string;
    settlement: string;
    area: string;
    street: string;
    streetNumber: string;
    block: string;
    entrance: string;
    floor: string;
    apartment: string;
    postCode: string;
  };
  invoiceSeriesPrefix: string;
  nextInvoiceSeq: number;
  createdAt: Date;
  updatedAt: Date;
  accountId: number;
  molName: string;
  registryId: number | null;
  source: "MANUAL" | "NAP_API";
  // contragents         Contragent[]
  // creditTransactions  CreditTransaction[]
  // generatedInvoices   GeneratedInvoice[]
  // account             Account               @relation(fields: [accountId], references: [id])
  // registry            CompanyRegistryCache? @relation(fields: [registryId], references: [id])
  // sourceDocuments     SourceDocument[]
};

export type OrganizationFormData = Omit<
  Organization,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "accountId"
  | "registryId"
  | "source"
  | "nextInvoiceSeq"
> & {
  bulstat?: string;
  vatNumber?: string;
  molName?: string;
  email?: string;
  bic?: string;
  iban?: string;
  bank?: string;
  registryId?: number | null;
};

export type ContragentFormData = {
  name: string;
  bulstat?: string;
  vatNumber?: string;
  molName?: string;
  email?: string;
  organizationId: number | null;
  address: {
    country?: string;
    region?: string;
    district?: string;
    municipality?: string;
    settlement?: string;
    area?: string;
    street?: string;
    streetNumber?: string;
    block?: string;
    entrance?: string;
    floor?: string;
    apartment?: string;
    postCode?: string;
  };
};

export type Account = {
  id: number;
  name: string;
  creditBalance: number;
  createdAt: Date;
  updatedAt: Date;
  // members            AccountMember[]
  // creditTransactions CreditTransaction[]
  // orders             Order[]
  organizations: Organization[];
};

export type AddressData = {
  country?: string;
  countryCode?: string;
  region?: string;
  district?: string;
  municipality?: string;
  settlement?: string;
  area?: string;
  street?: string;
  streetNumber?: string;
  block?: string;
  entrance?: string;
  floor?: string;
  apartment?: string;
  postCode?: string;
  districtid?: number;
};

export type Person = {
  name: string;
  indent: string;
  address: string;
};

export type ContactInfo = {
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
};

export type NKID = {
  code: string;
  description: string;
  id: string;
};

export type Capital = {
  amount?: string;
  currency?: string;
  paidAmount?: string;
};

export type RegisterInfo = {
  name?: string;
  vat?: string;
  address?: string;
  registrationDate?: string;
};

export type Partner = {
  person: Person;
  liabilityType?: string;
  contribution?: string;
};

export type CompanyData = {
  id?: string;
  uic: string;
  companyName?: {
    name: string;
    name_tags?: string[];
  };
  companyNameTransliteration?: {
    name: string;
    name_tags?: string[];
  };
  legalForm: string;
  status: string;
  seat?: AddressData;
  correspondenceSeat?: AddressData;
  contacts?: ContactInfo;
  subjectOfActivity?: string;
  nkids?: NKID[];
  managers?: Person[];
  representatives?: Person[];
  boardOfDirectors?: Person[];
  capital?: Capital;
  partners?: Partner[];
  registerInfo?: RegisterInfo;
  lastUpdated?: string;
};

export type SearchResult = {
  // Core identification
  bulstat: string;
  name: string;
  legalForm?: string;
  status?: string;

  // Address data (from seat, only essential fields)
  address?: {
    country?: string;
    countryCode?: string;
    district?: string;
    municipality?: string;
    settlement?: string;
    area?: string;
    street?: string;
    streetNumber?: string;
    block?: string;
    entrance?: string;
    floor?: string;
    apartment?: string;
    postCode?: string;
  };

  // Management
  molName?: string;

  // VAT info
  vatNumber?: string | null;

  // Contact info
  email?: string | null;

  // Additional metadata
  transliteration?: string;
  lastUpdated?: string;

  // Full raw data from API for caching
  rawLookupData?: CompanyData;
};

export type CompanyBookSearchResponse = {
  results: SearchResult[];
};
