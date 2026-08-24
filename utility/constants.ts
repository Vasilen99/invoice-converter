import { AlertStatus } from "./types";

export const EMAIL_REGEX =
  /^(([^<>()[\]\.,;:\s@"]+(\.[^<>()[\]\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$/i; // eslint-disable-line no-useless-escape

const dev = process.env.NODE_ENV !== "production";

// Use NEXT_PUBLIC_APP_URL for flexibility, falls back to localhost:8000
// This allows easy override via environment variables for different environments
const devServer = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8000";

export const server = dev
  ? devServer
  : "https://invoice-converter-fawn.vercel.app";

export const INITIAL_STATUS: AlertStatus = {
  status: "",
  statusHeader: "",
  statusContent: "",
};

export const PLATFORM_NAME = "Invoice Converter";
export const PROTECTED_ROUTES = ["/generator"];
