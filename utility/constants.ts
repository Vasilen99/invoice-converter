import { AlertStatus } from "./types";

export const EMAIL_REGEX =
  /^(([^<>()[\]\.,;:\s@"]+(\.[^<>()[\]\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$/i; // eslint-disable-line no-useless-escape

const dev = process.env.NODE_ENV !== "production";

//TODO: Add Prod server URL when deploying to production
export const server = dev ? "http://localhost:8080" : "https://invoice-converter-fawn.vercel.app";

export const INITIAL_STATUS: AlertStatus = {
  status: "",
  statusHeader: "",
  statusContent: "",
};

export const PROTECTED_ROUTES = [
  "/generator",
];