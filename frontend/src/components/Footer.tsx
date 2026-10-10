import { BrandLogo } from "@/components/BrandLogo";
import { useLanguage } from "@/context/LanguageContext";

export const Footer = () => {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="container mx-auto flex flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="max-w-sm space-y-2">
          <BrandLogo tagline />
          <p className="text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>
      </div>
      <div className="border-t border-border/60">
        <p className="container mx-auto px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          © {year} Barkha.Ai · {t("footer.data")}
        </p>
      </div>
    </footer>
  );
};
