import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-7xl font-semibold text-brand">404</p>
      <h1 className="mt-2 font-serif text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        {t("backHome")}
      </Link>
    </div>
  );
}
