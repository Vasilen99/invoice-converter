"use client";
import { globalStore } from "@/store/global";
import { server } from "../constants";

// Store translation function for use in async contexts
let tFunction: ((key: string) => string) | null = null;

export const setTranslationFunction = (t: (key: string) => string) => {
  tFunction = t;
};

export const callApi = async (
  url: string,
  options?: RequestInit,
  showAlert?: boolean,
) => {
  const { setIsLoading, setAlertStatus, isLoading } = globalStore.getState();

  if (!isLoading) setIsLoading(true);
  try {
    // Don't set Content-Type if body is FormData - let the browser set it automatically
    const headers: Record<string, string> = {};
    if (!(options?.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${server}/api${url}`, {
      method: options?.method || "GET",
      headers: {
        ...headers,
        ...(options?.headers || {}),
      },
      body: options?.body ? options.body : null,
    });

    if (response.status === 404) {
      return (window.location.href = "/404");
    }
    if (response.status === 401) {
      return (window.location.href = "/404");
    }

    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
      ? await response.json()
      : null;

    if ((showAlert || !response.ok) && result?.alert && tFunction) {
      setAlertStatus({
        status: result.alert.status,
        statusHeader: tFunction(result.alert.header),
        statusContent: tFunction(result.alert.message),
      });
    }
    return result.data;
  } catch (err) {
    if (err instanceof Error && showAlert && tFunction) {
      setAlertStatus({
        status: "error",
        statusHeader: tFunction("errorMessagesCommon.serverErrorHeader"),
        statusContent: tFunction("errorMessagesCommon.serverErrorMessage"),
      });
    }
  } finally {
    setIsLoading(false);
  }
};
