import { SUPPORTED_LOCALES, type Locale } from "@kaya/core";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

// Not a secret, but expo-secure-store is already a proven, working keychain
// read/write path in this app (see SecureTokenStore in @kaya/ui) and needs no
// new native module. Design doc §6 lists language alongside session as
// client-owned Zustand state, mirroring authStore.ts's shape.
const LOCALE_KEY = "kaya.locale";

export interface LocaleStoreState {
  /**
   * Undefined until `loadSavedLocale()` resolves, or forever if nothing was
   * ever saved. `KayaI18nProvider` treats an undefined `locale` prop as "use
   * the provider's own default" (French) -- there is no third "unknown"
   * status to track here the way auth's `status` needs one, since there is
   * no wrong screen a stale locale could strand the user on.
   */
  locale: Locale | undefined;
  /**
   * Reads the saved preference once, at startup (see `_layout.tsx`'s
   * `useLocaleRestoration`). Never throws and never rejects: a missing key,
   * an unrecognised value, or a rejecting keychain read all leave `locale`
   * undefined, which resolves to the provider's default the same way a
   * first launch does. This is exactly the async-read-then-controlled-prop
   * path phase 1B's KayaI18nProvider fix targets.
   */
  loadSavedLocale: () => Promise<void>;
  /** Switches the active locale and persists it so it survives a restart. */
  setLocale: (locale: Locale) => Promise<void>;
}

export const useLocaleStore = create<LocaleStoreState>((set) => ({
  locale: undefined,

  loadSavedLocale: async () => {
    const saved = await readSavedLocale();
    if (saved !== null) set({ locale: saved });
  },

  setLocale: async (locale) => {
    set({ locale });
    await SecureStore.setItemAsync(LOCALE_KEY, locale);
  },
}));

async function readSavedLocale(): Promise<Locale | null> {
  try {
    const value = await SecureStore.getItemAsync(LOCALE_KEY);
    if (value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value)) {
      return value as Locale;
    }
    return null;
  } catch {
    // Degrades exactly like SecureTokenStore's reads (@kaya/ui): a rejecting
    // keychain (e.g. right after install, before the device has been
    // unlocked once) must not block startup or throw into the render tree.
    return null;
  }
}
