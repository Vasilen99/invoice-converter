export type ApiAlertStatus = "success" | "error" | "warning" | "info";

export type ApiAlert = {
  status: ApiAlertStatus;
  header: string;
  message: string;
};

export type ApiResponse<T> = {
  data: T;
  alert: ApiAlert | null;
};
