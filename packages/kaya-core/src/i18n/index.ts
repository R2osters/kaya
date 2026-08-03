import { type i18n, createInstance } from "i18next";
import en from "./en.json";
import fr from "./fr.json";

/** French is the default; English is the toggle. */
export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

/**
 * Builds a standalone i18next instance. The React binding lives in @kaya/ui so
 * this package stays free of any React import.
 */
export function createI18n(locale: Locale = "fr"): i18n {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: "fr",
    resources,
    interpolation: { escapeValue: false },
  });
  return instance;
}
