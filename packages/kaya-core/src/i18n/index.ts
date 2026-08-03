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
 *
 * Interpolation is switched to single braces. The ARB files carry ICU-style
 * `{count}` placeholders and i18next defaults to `{{count}}`, so on the default
 * settings every string with a count, distance or percentage renders its
 * placeholder literally. Reconfiguring the delimiters keeps the ARB files the
 * source of truth rather than rewriting 155 strings into a second dialect.
 * Escaping stays off: these values render into React Native `Text`, not HTML.
 */
export function createI18n(locale: Locale = "fr"): i18n {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: "fr",
    resources,
    interpolation: {
      escapeValue: false,
      prefix: "{",
      suffix: "}",
    },
  });
  return instance;
}
