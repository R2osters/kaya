import { createI18n, SUPPORTED_LOCALES, type Locale } from "@kaya/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { I18nextProvider } from "react-i18next";

const DEFAULT_LOCALE: Locale = "fr";

export interface KayaI18nProviderProps {
  /**
   * Controlled, not just an initial value: changing `locale` on a later
   * render (e.g. once the app finishes reading a saved preference from
   * SecureStore and re-renders `<KayaI18nProvider locale={saved}>`) re-syncs
   * the active locale and the underlying i18next instance, without
   * requiring a remount. This mirrors a controlled `<input value>` — once
   * you pass this prop, it is the source of truth on every render where it
   * changes; drive language switches by updating whatever state you feed
   * into it. `useLocale().setLocale` remains available for a provider used
   * without this prop (self-managed), or for a one-off local switch, but if
   * this prop changes again afterwards it will override that switch, same
   * as a controlled input's `value` overrides an uncommitted edit.
   *
   * Typed as Locale, but callers routinely hand this a value that only
   * *claims* to be one — a persisted preference, a device locale lookup.
   * Runtime validation below is what actually enforces the fallback.
   */
  locale?: Locale;
  children: ReactNode;
  /**
   * Reports a failure to switch the underlying i18next instance's language
   * (e.g. `changeLanguage()` rejecting because a language-loading backend
   * failed). Fires for both a `locale` prop change and an imperative
   * `useLocale().setLocale()` call. Same convention as
   * `LocationWatchOptions.onError` (see @kaya/core's platform/location.ts):
   * left unhandled, a rejected promise here is a silent no-op at best and an
   * unhandled-rejection warning at worst, over a failure the caller deserves
   * to know about.
   */
  onLocaleChangeError?: (error: unknown) => void;
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
export function KayaI18nProvider({ locale, children, onLocaleChangeError }: KayaI18nProviderProps) {
  const [instance] = useState(() => createI18n(resolveLocale(locale)));
  const [current, setCurrent] = useState<Locale>(() => resolveLocale(locale));

  // `changeLanguage()` returning a rejected promise is the same
  // unhandled-rejection shape LocationAdapter.watch's onError catch exists
  // to prevent (see adapters/LocationAdapter.ts) — reported to the caller
  // rather than left to surface as a bare console warning or a fatal,
  // depending on the RN configuration.
  const changeLanguage = useCallback(
    (next: Locale) => {
      instance.changeLanguage(next).catch((error: unknown) => {
        onLocaleChangeError?.(error);
      });
    },
    [instance, onLocaleChangeError],
  );

  // useState's initializer above only ever runs once, at mount — without
  // this effect, a `locale` prop change on a later render (e.g. phase 1C
  // resolving the saved language from SecureStore asynchronously and
  // re-rendering with the result) would never reach `current` or the
  // i18next instance, and the UI would stay on whatever locale happened to
  // be current at mount time until a full remount.
  useEffect(() => {
    const safe = resolveLocale(locale);
    setCurrent((prev) => {
      if (prev === safe) return prev;
      changeLanguage(safe);
      return safe;
    });
  }, [locale, changeLanguage]);

  const setLocale = useCallback(
    (next: Locale) => {
      const safe = resolveLocale(next);
      changeLanguage(safe);
      setCurrent(safe);
    },
    [changeLanguage],
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
