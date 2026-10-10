import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import { isLanguageCode, LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  /** Compact shows only the native name in the trigger (for the header). */
  compact?: boolean;
  className?: string;
}

export const LanguageSwitcher = ({ compact = false, className }: LanguageSwitcherProps) => {
  const { language, setLanguage, t } = useLanguage();
  const current = LANGUAGES.find((option) => option.code === language);

  return (
    <Select value={language} onValueChange={(value) => isLanguageCode(value) && setLanguage(value)}>
      <SelectTrigger
        aria-label={t("lang.label")}
        className={cn(compact ? "h-9 w-auto gap-2 border-border/60 bg-transparent px-3" : "w-full", className)}
      >
        <Globe className="h-4 w-4 shrink-0 text-primary" />
        {compact ? (
          <span className="text-sm">{current?.nativeName}</span>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {LANGUAGES.map((option) => (
          <SelectItem key={option.code} value={option.code} lang={option.code}>
            {option.code === "en" ? option.name : `${option.nativeName} (${option.name})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
