/** Injection token for the active phone/identity verifier. */
export const PHONE_VERIFIER = 'PHONE_VERIFIER';

/**
 * Proof-of-possession checks the auth flows depend on.
 *
 * Every login path on this backend rests on one of these three assertions:
 * `login/otp` on `assertPhoneMatches`, `login/verify` (password + 2FA) on
 * `assertPhoneOrEmailMatches`, and `social` on `verifySocialToken`. Nothing
 * issues a token pair without one of them passing.
 *
 * It is an interface for the same reason `PaymentGateway`, `DistanceProvider`
 * and `GeocodingProvider` are: the project rule is that every external
 * integration ships an implementation usable with no key. Phone verification
 * was the one that never got one, so until now a checkout of this repo could
 * not log in at all -- which made the whole client app unbuildable against a
 * real backend without a Firebase project.
 *
 * The implementations are `FirebaseVerifier` (real, the default) and
 * `MockPhoneVerifier` (development only, gated -- see its own doc and
 * auth.module.ts).
 */
export interface PhoneVerifier {
  /** Name, for logs and for asserting which one is live. */
  readonly name: string;

  /** Asserts the token proves possession of `expectedPhone`. */
  assertPhoneMatches(idToken: string, expectedPhone: string): Promise<void>;

  /**
   * Asserts the token proves possession of either the phone or the *verified*
   * email. Used by password-login 2FA, where the user picks the channel and
   * the backend accepts whichever proof arrives.
   */
  assertPhoneOrEmailMatches(
    idToken: string,
    expectedPhone: string,
    expectedEmail: string,
  ): Promise<void>;

  /**
   * Verifies a social sign-in token and returns the identity it asserts. No
   * cross-check against an existing account: the token's own email claim is
   * the identity.
   */
  verifySocialToken(idToken: string): Promise<{ email: string; name?: string }>;
}
