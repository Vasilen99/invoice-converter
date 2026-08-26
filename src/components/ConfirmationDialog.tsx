"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/animate-ui/components/radix/dialog";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

type ActionCallback = (
  ...args: Array<string | number | boolean | object>
) => void | Promise<void>;

type ConfirmationDialogProps<
  T extends ActionCallback = () => void | Promise<void>,
> = {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  mainActionButtonContent: string;
  onMainAction: T;
  onSecondaryAction?: ActionCallback;
  secondaryActionContent?: string;
};

export default function ConfirmationDialog<
  T extends ActionCallback = () => void | Promise<void>,
>({
  isOpen,
  onClose,
  title,
  description,
  mainActionButtonContent,
  onMainAction,
  onSecondaryAction,
  secondaryActionContent,
}: ConfirmationDialogProps<T>) {
  const t = useTranslations();
  return (
    <Dialog open={isOpen} onOpenChange={(isOpen) => !isOpen && onClose()}>
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
          <div
            key="head"
            className="flex flex-col items-center gap-2 text-center"
          >
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </div>
          <div className="w-full flex gap-4 lg:flex-row flex-col items-center justify-center">
            <motion.button
              key="secondary-action"
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (onSecondaryAction) {
                  onSecondaryAction();
                }
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background/50 py-2.5 text-sm font-medium transition-colors hover:bg-muted lg:hover:cursor-pointer"
            >
              {secondaryActionContent ?? t("confirmationDialog.confirmCancel")}
            </motion.button>
            <motion.button
              key="main-action"
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                await onMainAction();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-primary/80 text-primary-foreground py-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-primary lg:hover:cursor-pointer"
            >
              {mainActionButtonContent}
            </motion.button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
