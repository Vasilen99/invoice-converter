import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";

const NotFound = async () => {
  const t = await getTranslations("notFound");

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-muted-foreground" />
        </div>

        <p className="text-7xl font-bold tracking-tight text-foreground mb-3">
          404
        </p>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">{t("description")}</p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors btn-glow"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
