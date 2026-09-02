import { Upload } from "lucide-react";

type UploadZoneProps = {
  dragOver: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  t: (key: string) => string;
  setDragOver: (value: boolean) => void;
};

export const UploadZone = ({
  dragOver,
  inputRef,
  handleDrop,
  t,
  setDragOver,
}: UploadZoneProps) => {
  return (
    <div
      className={`relative group rounded-2xl p-12 flex flex-col items-center justify-center gap-5 cursor-pointer hover:cursor-pointer transition-all duration-300 overflow-hidden
            border-2 ${dragOver ? "border-ring bg-accent/30 animate-border-dance" : "border-dashed border-border hover:border-ring/60"}
          `}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Subtle background glow on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-foreground/5 via-transparent to-foreground/5" />

      <div
        className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300
            bg-secondary
            ${dragOver ? "animate-pulse-glow scale-110" : "group-hover:scale-105"}
          `}
      >
        <Upload
          className={`w-9 h-9 text-foreground/70 transition-transform duration-300 ${dragOver ? "scale-110" : "group-hover:-translate-y-1"}`}
        />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          {dragOver ? t("dropHere") : t("clickOrDrag")}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{t("onlyPdf")}</p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className="btn-glow px-8 py-2.5 rounded-xl text-sm font-bold text-primary-foreground
              bg-primary hover:bg-primary/90"
      >
        {t("choosePdf")}
      </button>
    </div>
  );
};
