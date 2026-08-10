/**
 * Proof that the user holds a phone number, in the form every auth endpoint
 * expects: a `firebaseIdToken`.
 *
 * Four screens need this -- sign-up, password reset, the 2FA step of a
 * password login, and the passwordless login -- and all four care about the
 * same two moments: a code is requested, then a code is confirmed and a token
 * comes back. Which service actually issues that token is not their business,
 * which is why it sits behind this seam.
 *
 * **Today there is one implementation and it is the development one.** It
 * pairs with the backend's `MockPhoneVerifier` (FIREBASE_VERIFIER=mock) and
 * accepts any code, because nothing sends an SMS. Real Firebase Phone Auth
 * needs `@react-native-firebase/auth`, a configured Firebase project, and
 * Play Integrity / reCAPTCHA on the device -- a task in its own right, and one
 * that changes nothing above this line: the screens will not know.
 *
 * The two halves are deliberately symmetric with the backend. A mock client
 * against a real verifier fails (the token has the wrong shape), and a real
 * client against the mock verifier fails too. The two configurations cannot be
 * silently mixed.
 */

/** Mirrors MOCK_PREFIX in backend/src/auth/verifiers/mock.verifier.ts. */
const MOCK_TOKEN_PREFIX = "kaya-mock-verifier:";

export interface PhoneVerification {
  /**
   * Starts verification for a number. Returns a handle the confirmation step
   * needs -- Firebase's is a verification id, and the mock's is the phone
   * itself, which is why callers must treat it as opaque.
   */
  sendCode: (phone: string) => Promise<string>;
  /**
   * Confirms the code and returns the `firebaseIdToken` to send to the
   * backend. The mock accepts any non-empty code, since no SMS was sent.
   */
  confirmCode: (handle: string, code: string) => Promise<string>;
}

/**
 * Development implementation. Sends nothing, accepts any non-empty code, and
 * returns the token the backend's mock verifier recognises.
 */
export const devPhoneVerification: PhoneVerification = {
  // Both are `async` deliberately. Throwing synchronously out of a method
  // whose signature says Promise makes a caller using `.catch()` take an
  // uncaught exception instead of a handled rejection -- the same footgun the
  // backend's MockPhoneVerifier had, caught the same way, by a test.
  sendCode: async (phone: string) => {
    const trimmed = phone.trim();
    if (trimmed === "") {
      throw new Error("A phone number is required.");
    }
    return trimmed;
  },

  confirmCode: async (handle: string, code: string) => {
    // The code is still required, and still has to be entered. Accepting an
    // empty one would let the screen's own "did the user fill this in" check
    // rot unnoticed, and slice C's screens are the ones that check it.
    if (code.trim() === "") {
      throw new Error("A verification code is required.");
    }
    return `${MOCK_TOKEN_PREFIX}${handle}`;
  },
};

/** The implementation the app uses. One line to change when Firebase lands. */
export const phoneVerification: PhoneVerification = devPhoneVerification;
