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

// Plain CommonJS, imported by path: Expo evaluates app.config.ts through a
// CJS loader that will not resolve a TypeScript module outside the app
// directory, so the shared guard ships as .js rather than .ts.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertDevFlagsAreSafe } = require("../../tools/devFlagGuard.js") as {
  assertDevFlagsAreSafe: (env?: NodeJS.ProcessEnv) => { skipAuth: boolean; otpDisabled: boolean };
};

/**
 * Fails the build when SKIP_AUTH or OTP_DISABLED is set for anything that
 * could reach real users. See tools/devFlagGuard.ts for why the check is on
 * the backend being targeted rather than on the build type.
 */
const DEV_FLAGS = assertDevFlagsAreSafe();

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
    skipAuth: DEV_FLAGS.skipAuth,
    otpDisabled: DEV_FLAGS.otpDisabled,
  },
};

export default config;
