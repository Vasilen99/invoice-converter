"use client";

import React, { useEffect } from "react";
import { userStore } from "@/store/user";

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const fetchUser = userStore((state) => state.fetchUser);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    return <>{children}</>;
};

export default AppProvider;
