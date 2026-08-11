import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { api } from "../api/client";
import { phoneVerification } from "../auth/phoneVerification";

/**
 * The sign-up, reset and 2FA flows, phase 2 slice C.
 *
 * Each of these pairs a phone-verification step with a backend call. The
 * verification half comes from src/auth/phoneVerification.ts -- the mock today,
 * Firebase later -- and none of these hooks knows which.
 *
 * Kept apart from queries/auth.ts, which holds only the passwordless sign-in
 * used by slice A, so a screen that just signs someone in does not pull the
 * whole registration surface with it.
 */

/**
 * Requests a verification code for a phone number and returns the opaque
 * handle the confirmation step needs.
 *
 * Not retried. A retry sends a second SMS, which costs money and reads to the
 * user as the platform spamming them -- and the backend's own send limits
 * (`OTP_SEND_MAX` per window) would start rejecting the extras.
 */
export function useSendVerificationCode(): UseMutationResult<string, unknown, string> {
  return useMutation({
    mutationFn: (phone: string) => phoneVerification.sendCode(phone),
  });
}

export interface ResetPasswordInput {
  phone: string;
  code: string;
  newPassword: string;
}

/**
 * Confirms the code and sets the new password.
 *
 * The two steps are one mutation because they are one user intent and because
 * the proof is single-use: confirming the code and then failing to send it
 * would leave the user holding a token they cannot spend, with nothing on
 * screen saying so.
 */
export function useResetPassword(): UseMutationResult<void, unknown, ResetPasswordInput> {
  return useMutation({
    mutationFn: async ({ phone, code, newPassword }: ResetPasswordInput) => {
      const trimmed = phone.trim();
      const handle = await phoneVerification.sendCode(trimmed);
      const firebaseIdToken = await phoneVerification.confirmCode(handle, code);

      await api.passwordReset({ phone: trimmed, firebaseIdToken, newPassword });
    },
  });
}

export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  countryCode: string;
  code: string;
  /**
   * Country-specific and mandatory on this side: Ghana wants a PCSRC number
   * (PCSRC-2024-001234) plus a QR code, Togo a carte pro (CPL-TG-...), Benin a
   * permis livreur (PL-BEN-...). The backend validates the format per country
   * -- see backend/src/auth/driver-validation.ts -- so the screen collects
   * them rather than guessing.
   */
  driverLicenseNumber: string;
  driverQrCode?: string;
  vehicleType?: string;
}

/**
 * Registers a driver account, proving the phone first.
 *
 * Never retried, and this one matters more than most: a replayed register is a
 * second account on the same phone, which the backend rejects with a 409 --
 * leaving a user who has just typed everything correctly staring at a conflict
 * error for an account they created a second ago.
 */
export function useRegister(): UseMutationResult<unknown, unknown, RegisterInput> {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const phone = input.phone.trim();
      const handle = await phoneVerification.sendCode(phone);
      const firebaseIdToken = await phoneVerification.confirmCode(handle, input.code);

      return api.register({
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone,
        password: input.password,
        countryCode: input.countryCode,
        role: "livreur",
        driverLicenseNumber: input.driverLicenseNumber.trim(),
        // Omitted rather than sent empty: Ghana requires a QR code and the
        // other two countries have no column for one, so an empty string
        // would be a value where the backend expects absence.
        ...(input.driverQrCode === undefined || input.driverQrCode.trim() === ""
          ? {}
          : { driverQrCode: input.driverQrCode.trim() }),
        ...(input.vehicleType === undefined ? {} : { vehicleType: input.vehicleType }),
        firebaseIdToken,
      });
    },
  });
}
