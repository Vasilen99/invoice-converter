"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useGlobalStore } from "@/store/global";
import { toast, Toaster } from "sonner";
import { TriangleAlert, CircleCheck } from "lucide-react";

const icons = {
  error: <TriangleAlert />,
  success: <CircleCheck />,
};

function AlertDemoContent() {
  const [position, setPosition] = useState<"bottom-left" | "bottom-center">(
    "bottom-left",
  );
  const globalState = useGlobalStore();
  const { alertStatus } = globalState;
  const lastAlertRef = useRef<typeof alertStatus | null>(null);

  useEffect(() => {
    const updatePos = () =>
      setPosition(window.innerWidth < 1024 ? "bottom-center" : "bottom-left");
    updatePos();
    window.addEventListener("resize", updatePos);
    return () => window.removeEventListener("resize", updatePos);
  }, []);

  useEffect(() => {
    // Skip if no alert data
    if (!alertStatus?.status) {
      return;
    }

    // Prevent duplicate toasts for the same alert
    if (
      lastAlertRef.current?.status === alertStatus.status &&
      lastAlertRef.current?.statusContent === alertStatus.statusContent &&
      lastAlertRef.current?.action?.label === alertStatus.action?.label
    ) {
      return;
    }

    // Store current alert to prevent duplicates
    lastAlertRef.current = alertStatus;

    // Prepare toast options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toastOptions: any = {};

    // Add description if available
    if (alertStatus.statusContent) {
      toastOptions.description = alertStatus.statusContent;
    }

    // Add action if available
    if (alertStatus.action) {
      toastOptions.action = {
        label: alertStatus.action.label,
        onClick: alertStatus.action.onClick,
      };
    }

    // Show toast based on status
    toast[alertStatus.status](alertStatus.statusHeader, toastOptions);

    // Optional: Clear the alert from global state after showing
    // globalState.setAlertStatus(null);
  }, [alertStatus, globalState]);

  return (
    <Toaster
      className={
        alertStatus?.status === "success"
          ? "bg-success text-success-content"
          : alertStatus?.status === "error"
            ? "bg-error text-error-content"
            : ""
      }
      position={position}
      visibleToasts={3}
      containerAriaLabel="Application notifications"
      closeButton
      icons={icons}
      duration={5000}
      richColors
      expand
    />
  );
}

const AlertDemo = dynamic(() => Promise.resolve(AlertDemoContent), {
  ssr: false,
  loading: () => null,
});

export { AlertDemo };
