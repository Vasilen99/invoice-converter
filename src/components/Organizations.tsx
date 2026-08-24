"use client";
import { FadeIn } from "./motion";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/animate-ui/components/radix/dialog";
import { useState } from "react";
import { motion } from "framer-motion";

export default function Organizations() {
  const t = useTranslations();
  const organizations = []; // Replace with actual data fetching logic
  const [open, setOpen] = useState<boolean>(false);
  return (
    <>
      <div className="text-2xl">
        <FadeIn delay={0.01}>
          <div className="grid lg:grid-cols-2 lg:gap-0 grid-cols-1 gap-3 justify-between lg:items-start">
            <span className="flex flex-col gap-2">
              <h1 className="flex items-center gap-2 text-primary text-2xl font-bold">
                {t("organizations.organizationsHeader")}
              </h1>
              <p className="text-base">
                {t("organizations.organizationsSubheader")}
              </p>
            </span>
            <Button
              onClick={() => setOpen((prev) => !prev)}
              className="w-fit lg:ml-auto"
            >
              {t("organizations.addOrganization")}
            </Button>
          </div>
        </FadeIn>
        <FadeIn delay={0.02} className="pt-12">
          {organizations.length === 0 && (
            <p className="text-base text-primary/50">
              {t("organizations.noOrganizations")}
            </p>
          )}
        </FadeIn>
      </div>
      <Dialog
        open={open}
        onOpenChange={(isOpen: boolean) => !isOpen && setOpen(false)}
      >
        <DialogContent
          from="bottom"
          overlayClassName="bg-background/60 backdrop-blur-md"
          className="glass max-w-[min(850px,calc(100%-2rem))] rounded-2xl border border-border p-8 shadow-2xl"
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              show: {
                transition: { staggerChildren: 0.07, delayChildren: 0.1 },
              },
            }}
            className="flex flex-col gap-5"
          >
            {[
              <div
                key="head"
                className="flex flex-col items-center gap-2 text-center"
              >
                <DialogTitle className="text-2xl font-semibold tracking-tight">
                  {t("organizations.addOrganization")}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {t("organizations.addOrganizationDescription")}
                </DialogDescription>
              </div>,

              // <form
              //   key="form"
              //   onSubmit={loginUser}
              //   className="flex flex-col gap-3"
              // >
              //   <label htmlFor="login-email" className="text-sm font-medium">
              //     {t("emailLabel")}
              //   </label>
              //   <div className="relative">
              //     <Mail
              //       size={16}
              //       className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              //     />
              //     <input
              //       id="login-email"
              //       type="email"
              //       required
              //       value={state.email}
              //       onChange={(e) => setState({ email: e.target.value })}
              //       placeholder={t("emailPlaceholder")}
              //       className="w-full rounded-lg border border-border bg-background/50 py-2.5 pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
              //     />
              //   </div>
              //   <motion.button
              //     type="submit"
              //     whileHover={{ scale: 1.02 }}
              //     whileTap={{ scale: 0.98 }}
              //     className="btn-glow group mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-medium text-background"
              //   >
              //     {t("continueWithEmail")}
              //     <ArrowRight
              //       size={16}
              //       className="transition-transform group-hover:translate-x-0.5"
              //     />
              //   </motion.button>
              // </form>,

              // <div key="sep" className="flex items-center gap-3">
              //   <div className="h-px flex-1 bg-border" />
              //   <span className="text-xs uppercase tracking-wider text-muted-foreground">
              //     {t("or")}
              //   </span>
              //   <div className="h-px flex-1 bg-border" />
              // </div>,

              <motion.button
                key="google"
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/50 py-2.5 text-sm font-medium transition-colors hover:bg-muted lg:hover:cursor-pointer"
              >
                {t("organizations.add")}
              </motion.button>,
            ].map((node, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                }}
              >
                {node}
              </motion.div>
            ))}
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}
