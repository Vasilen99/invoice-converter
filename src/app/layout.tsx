import React from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import AppProvider from "@/components/AppProvider";
import dynamic from "next/dynamic";

const Alert = dynamic(() =>
  import("@/components/Alert").then((mod) => mod.AlertDemo),
);
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const Layout: React.FC<{ children: React.ReactNode }> = async ({
  children,
}) => {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("dark font-sans", geist.variable)}
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.remove('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider>
          <AppProvider>
            {children}
            <Alert />
          </AppProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default Layout;
