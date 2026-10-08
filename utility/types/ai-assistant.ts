export type AccountContragentSnapshot = {
  id: number;
  name: string;
  bulstat: string | null;
  vatNumber: string | null;
  molName: string | null;
  address: unknown;
  organizationId: number;
};

export type AccountOrgSnapshot = {
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
  contragents: AccountContragentSnapshot[];
};

export type AccountContext = {
  accountMembers: {
    accountId: number;
    account: {
      creditBalance: number;
      composer_name: string | null;
      inv_template: string | null;
      organizations: AccountOrgSnapshot[];
    };
  }[];
};
