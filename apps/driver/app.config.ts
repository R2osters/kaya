import type { ExpoConfig } from "expo/config";

/**
 * The product's final brand name is not chosen yet (BLUEPRINT.md decisions
 * log, 2026-07-10 — "Kaya" is the working name used across prototypes only).
 * This constant is the single place a build-visible name is set; nothing
 * else in this app may hardcode a brand string.
 */
const APP_NAME = "Kaya Driver";

/**
 * Application id stays provisional per the decisions log (BLUEPRINT.md,
 * 2026-07-11): renamed on Android (applicationId) and iOS (bundleIdentifier)
 * together, once the final product name is chosen, before first publication.
 */
const APPLICATION_ID = "com.kaya.kaya_driver";

/**
 * True for any build that is not a developer running the app locally in dev
 * mode: `expo export`/`eas build` and any native release build set
 * NODE_ENV=production; an EAS build additionally reports which profile it
 * ran through. Checking the profile rather than bare EAS_BUILD means an EAS
 * *development* or *preview* profile is not treated as production here.
 */
const IS_PRODUCTION_BUILD =
  process.env.NODE_ENV === "production" || process.env.EAS_BUILD_PROFILE === "production";

const SKIP_AUTH = process.env.SKIP_AUTH === "true";

/**
 * SKIP_AUTH exists so a screen can be opened without a backend during
 * development -- it must never be a way into a real user's account. A
 * runtime `if` inside a screen cannot gate it: the flag's whole purpose is
 * to change behaviour *before* any screen renders, so the check has to live
 * here, at config evaluation time, which every build path (`expo start`,
 * `expo prebuild`, `expo export`, `eas build`) runs before anything else.
 * Throwing here fails the build outright rather than shipping a binary that
 * silently honours the flag.
 */
if (IS_PRODUCTION_BUILD && SKIP_AUTH) {
  throw new Error(
    "SKIP_AUTH must not be set for a production build. Unset the SKIP_AUTH " +
      "environment variable before building for release.",
  );
}

const config: ExpoConfig = {
  name: APP_NAME,
  slug: "kaya-driver",
  scheme: "kayadriver",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    // Native launch-screen config, generated before the JS tree mounts, so it
    // sits outside @kaya/ui's colour-literal rule the same way
    // packages/kaya-ui/src/theme/colors.ts itself does. Value mirrors
    // colors.surface there; keep the two in sync by eye.
    backgroundColor: "#FFFFFF",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: APPLICATION_ID,
  },
  android: {
    package: APPLICATION_ID,
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Read by src/config/env.ts through expo-constants. No production host
    // is hardcoded here -- an unset value stays null and env.ts's dev-only
    // localhost fallback never ships as a bundled literal for this key.
    apiBaseUrl: process.env.API_BASE_URL ?? null,
    mapsApiKey: process.env.MAPS_API_KEY ?? null,
    skipAuth: SKIP_AUTH,
    otpDisabled: process.env.OTP_DISABLED === "true",
  },
};

export default config;
