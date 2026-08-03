import { createI18n, SUPPORTED_LOCALES, type Locale } from "@kaya/core";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { I18nextProvider } from "react-i18next";

const DEFAULT_LOCALE: Locale = "fr";

export interface KayaI18nProviderProps {
  /**
   * Typed as Locale, but callers routinely hand this a value that only
   * *claims* to be one — a persisted preference, a device locale lookup.
   * Runtime validation below is what actually enforces the fallback.
   */
  locale?: Locale;
  children: ReactNode;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Anything outside SUPPORTED_LOCALES resolves to French rather than throwing. */
function resolveLocale(locale: Locale | undefined): Locale {
  if (locale !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * React binding for the standalone i18next instance @kaya/core builds.
 * @kaya/core cannot depend on react-i18next (design decision D2, enforced by
 * the lint rule in packages/kaya-core/.eslintrc.cjs), so the context and the
 * useLocale() hook live here instead.
 */
export function KayaI18nProvider({ locale, children }: KayaI18nProviderProps) {
  const [instance] = useState(() => createI18n(resolveLocale(locale)));
  const [current, setCurrent] = useState<Locale>(() => resolveLocale(locale));

  const setLocale = useCallback(
    (next: Locale) => {
      const safe = resolveLocale(next);
      void instance.changeLanguage(safe);
      setCurrent(safe);
    },
    [instance],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale: current, setLocale }),
    [current, setLocale],
  );

  return (
    <I18nextProvider i18n={instance}>
      <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
    </I18nextProvider>
  );
}

/** Current locale plus a setter, backed by the KayaI18nProvider above it. */
export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context === null) {
    throw new Error("useLocale must be used within a KayaI18nProvider");
  }
  return context;
}
