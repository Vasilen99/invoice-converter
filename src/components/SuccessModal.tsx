import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./animate-ui/components/radix/dialog";
import { CheckCircle2 } from "lucide-react";
type SuccessGenerationModalProps = {
  open: boolean;
  onClose: () => void;
  t: (key: string, options?: Record<string, string | number>) => string;
};

export const SuccessGenerationModal = ({
  open,
  onClose,
  t,
}: SuccessGenerationModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        from="bottom"
        overlayClassName="bg-background/80 backdrop-blur-md"
        className="glass max-w-[min(620px,calc(100%-2rem))] rounded-2xl border border-border p-6 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("successGenerationModal.title")}
            </DialogTitle>
            <DialogDescription className="text-sm text-primary">
              {t("successGenerationModal.description")}
            </DialogDescription>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-lg border border-border bg-primary/90 px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary transition-colors hover:cursor-pointer"
          >
            {t("successGenerationModal.close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
