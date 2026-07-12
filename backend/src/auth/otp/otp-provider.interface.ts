/** Injection token for the active OTP delivery provider. */
export const OTP_PROVIDER = 'OTP_PROVIDER';

export interface OtpDeliveryTarget {
  phone?: string;
  email?: string;
}

/**
 * Delivers an OTP code to the user through some channel (SMS/email).
 * Swappable behind this interface so production (Twilio/SendGrid) can drop in
 * without touching auth logic. The dev provider just logs the code.
 */
export interface OtpProvider {
  readonly name: string;
  send(target: OtpDeliveryTarget, code: string): Promise<void>;
}
