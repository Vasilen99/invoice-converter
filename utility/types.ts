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
  legalName: string;
  bulstat: string | null;
  vatNumber: string | null;
};
export type Organization = {
  id: number;
  legalName: string;
  bulstat: string;
  vatNumber: string;
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
  registryId?: number | null;
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

export type CompanyBookSearchResult = {
  uic: string;
  name: string;
  legalForm: string;
  status: string;
  district: string;
  transliteration: string;
  vatRegistered: boolean;
  lastUpdated?: string;
  contactPresence?: {
    email: boolean;
    phone: boolean;
    website: boolean;
  };
  activeFinancialYear?: number;
  latestRevenue?: string;
  address?: AddressData;
  seat?: AddressData;
  managers?: Person[];
  // Full data fields (when with_data=true)
  company?: CompanyData;
  history?: Array<any>;
  daughters?: Array<any>;
  // Direct contact fields (when with_data=true)
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  contacts?: ContactInfo;
  // Direct management fields (when with_data=true)
  representatives?: Person[];
  boardOfDirectors?: Person[];
  correspondenceSeat?: AddressData;
  // Business info (when with_data=true)
  subjectOfActivity?: string;
  nkids?: NKID[];
  // Ownership (when with_data=true)
  capital?: Capital;
  partners?: Partner[];
  // Registration (when with_data=true)
  registerInfo?: RegisterInfo;
};

export type CompanyBookSearchResponse = {
  results: CompanyBookSearchResult[];
  total: string;
  totalCount: number;
  hasMoreTotal: boolean;
  limit: number;
  offset: number;
};
