"use client";
import { globalStore } from "@/store/global";
import { server } from "../constants";
import { useTranslations } from "next-intl";

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
    const response = await fetch(`${server}/api${url}`, {
      method: options?.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      body: options?.body ? options.body : null,
    });

    const result = await response.json();

    if (response.status === 404) {
      return (window.location.href = "/404");
    }
    if (response.status === 401) {
      return (window.location.href = "/404");
    }

    if ((showAlert || !response.ok) && result.alert && tFunction) {
      setAlertStatus({
        status: result.alert.status,
        statusHeader: tFunction(result.alert.header),
        statusContent: tFunction(result.alert.message),
      });
      // if (!response.ok) {
      //   console.error("Status code:", response.status);
      //   console.error(
      //     "Error message:",
      //     `${result.alert.header}: ${result.alert.message}`,
      //   );
      // }
    }
    return result.data;
  } catch (err) {
    if (err instanceof Error && showAlert && tFunction) {
      setAlertStatus({
        status: "error",
        statusHeader: tFunction("errorMessagesCommon.serverErrorHeader"),
        statusContent: tFunction("errorMessagesCommon.serverErrorMessage"),
      });
      console.error("API server error:", err.message);
    }
  } finally {
    setIsLoading(false);
  }
};
