import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LANGUAGE,
  isLanguageCode,
  isRtl,
  translate,
  type LanguageCode,
  type TranslationKey,
  type TranslationVars,
} from "@/lib/i18n";
import { readString, writeString } from "@/lib/storage";

const LANGUAGE_KEY = "barkha_language";

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
  /** BCP 47 locale for number and date formatting, e.g. "hi-IN". */
  locale: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const initialLanguage = (): LanguageCode => {
  const saved = readString(LANGUAGE_KEY);
  return isLanguageCode(saved) ? saved : DEFAULT_LANGUAGE;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>(initialLanguage);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    writeString(LANGUAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl(language) ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
      locale: `${language}-IN`,
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
};
