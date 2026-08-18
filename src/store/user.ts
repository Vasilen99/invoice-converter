import { callApi } from "../../utility/hooks/apiFetch";
import { User } from "../../utility/types";
import { create } from "zustand";

export type UserStore = {
  user: User | null;
  setUser: (userData: User) => void;
  fetchUser: () => void;
  logout: () => void;
};

export const userStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => {
    set(() => ({ user }));
  },
  fetchUser: async () => {
    const userResult = await callApi("/auth/user/get");
    if (userResult) {
      set({ user: userResult });
    }
  },
  logout: async () => {
    const result = await callApi("/auth/logout");
    if (!result) return;
    set({ user: null });
  },
}));
