/**
 * Build-time guard for the two development flags that weaken authentication.
 *
 * Shared by both apps' `app.config.ts` rather than duplicated: a security
 * check that has to be fixed in two places is a security check that will be
 * fixed in one. This is build tooling, not app code, so it does not breach
 * the rule that apps compose the packages and add nothing to them.
 *
 * `SKIP_AUTH` bypasses authentication entirely so a screen can be opened with
 * no backend. `OTP_DISABLED` skips the one-time-code step of a real sign-in.
 * The second reads as milder and is not: with phone-based auth, skipping the
 * code means *knowing* a phone number is enough to obtain a session as that
 * person — no possession of the device required — and a phone number is
 * usually the easier of the two to come by.
 *
 * Both are safe against a sandbox and dangerous against anything else, so the
 * check is on the backend they point at, not on the build type. Keying only on
 * NODE_ENV would let a debug APK aimed at the real API build and be sideloaded
 * to testers with authentication switched off.
 */

/** Hosts a development flag may legitimately be pointed at. */
const LOCAL_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  // The Android emulator's alias for the host machine's loopback.
  "10.0.2.2",
];

/**
 * @param {string | undefined} apiBaseUrl
 * @returns {boolean}
 */
function isLocalBackend(apiBaseUrl) {
  if (apiBaseUrl === undefined || apiBaseUrl === "") {
    // Unset means env.ts's localhost fallback, which is local by definition.
    return true;
  }
  try {
    const { hostname } = new URL(apiBaseUrl);
    return (
      LOCAL_HOSTS.includes(hostname) ||
      hostname.endsWith(".local") ||
      // A private-range address is a machine on the developer's own network,
      // typically a phone talking to a laptop.
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    // An unparseable URL is not something to grant the benefit of the doubt.
    return false;
  }
}

/**
 * Throws — failing the build — when a development flag is set for a build that
 * could reach real users. Called from `app.config.ts`, which every build path
 * evaluates before anything else: `expo start`, `expo export`, `eas build`,
 * and a bare Gradle release (whose `bundleCommand` shells back out to
 * `expo export:embed`).
 */
/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ skipAuth: boolean, otpDisabled: boolean }}
 */
function assertDevFlagsAreSafe(env = process.env) {
  const skipAuth = env.SKIP_AUTH === "true";
  const otpDisabled = env.OTP_DISABLED === "true";

  if (!skipAuth && !otpDisabled) {
    return { skipAuth: false, otpDisabled: false };
  }

  const isProductionBuild =
    env.NODE_ENV === "production" || env.EAS_BUILD_PROFILE === "production";
  const targetsLocalBackend = isLocalBackend(env.API_BASE_URL);

  const enabled = [skipAuth && "SKIP_AUTH", otpDisabled && "OTP_DISABLED"]
    .filter(Boolean)
    .join(" and ");

  if (isProductionBuild) {
    throw new Error(
      `${enabled} must not be set for a production build. These flags weaken ` +
        `authentication and exist only for local development. Unset them before ` +
        `building for release.`,
    );
  }

  if (!targetsLocalBackend) {
    throw new Error(
      `${enabled} is set while API_BASE_URL points at ${env.API_BASE_URL ?? "(unset)"}, ` +
        `which is not a local development backend. A build with authentication ` +
        `weakened and a real backend behind it can be installed on any device. ` +
        `Point API_BASE_URL at localhost, an emulator alias, or a private-network ` +
        `address, or unset the flag.`,
    );
  }

  return { skipAuth, otpDisabled };
}

module.exports = { assertDevFlagsAreSafe };
