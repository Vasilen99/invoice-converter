import { AlertStatus } from "../../utility/types";
import { INITIAL_STATUS } from "../../utility/constants";
import { create } from "zustand";

export type GlobalStore = {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (isOpen: boolean) => void;
  alertStatus: AlertStatus | undefined;
  setAlertStatus: (newStatus: AlertStatus) => void;
  theme: string;
  setTheme: (newTheme: string) => void;
};

export const globalStore = create<GlobalStore>((set, get) => ({
  isLoading: false,
  setIsLoading: (isLoading: boolean) => {
    if (get().isLoading !== isLoading) {
      set(() => ({ isLoading: isLoading }));
    }
  },
  isLoginModalOpen: false,
  setIsLoginModalOpen: (isOpen: boolean) => {
    if (get().isLoginModalOpen !== isOpen) {
      set(() => ({ isLoginModalOpen: isOpen }));
    }
  },
  alertStatus: INITIAL_STATUS,
  setAlertStatus: (newStatus: AlertStatus) =>
    set(() => ({ alertStatus: newStatus })),
  theme: "light",
  setTheme: (newTheme: string) => set(() => ({ theme: newTheme })),
}));

export const useGlobalStore = globalStore;
