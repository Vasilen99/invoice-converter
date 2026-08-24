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
