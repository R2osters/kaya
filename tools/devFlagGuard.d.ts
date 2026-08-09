/**
 * Types for the CommonJS guard. The implementation ships as .js so Expo's
 * config loader can require it from outside an app directory; this file is
 * what gives the app configs and the tests a checked signature.
 */
export interface DevFlagState {
  skipAuth: boolean;
  otpDisabled: boolean;
}

export function assertDevFlagsAreSafe(env?: NodeJS.ProcessEnv): DevFlagState;
