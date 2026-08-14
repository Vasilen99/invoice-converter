"use client";
import { globalStore } from "@/store/global";
import { server } from "../constants";
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

    if ((showAlert || !response.ok) && result.alert) {
      setAlertStatus({
        status: result.alert.status,
        statusHeader: result.alert.header,
        statusContent: result.alert.message,
      });
      if (!response.ok) {
        console.error("Status code:", response.status);
        console.error(
          "Error message:",
          `${result.alert.header}: ${result.alert.message}`,
        );
      }
    }
    return result.data;
  } catch (err) {
    if (err instanceof Error && showAlert) {
      setAlertStatus({
        status: "error",
        statusHeader: "Server error",
        statusContent: err.message,
      });
      console.error("API server error:", err.message);
    }
  } finally {
    setIsLoading(false);
  }
};
