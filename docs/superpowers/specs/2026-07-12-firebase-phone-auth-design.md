# Firebase Phone Auth — design spec

Date: 2026-07-12
Status: approved by user, pending implementation plan

## Problem

The OTP flow was reported broken ("le système de OTP ne fonctionne pas"). Root cause: both
`apps/client` and `apps/driver` OTP screens hardcoded a `123456` pre-fill in the code field, while
`OtpService.generateCode()` (backend) generates a real random 6-digit code logged only to the
backend console. The pre-fill almost never matched the real code. This specific bug is already
fixed (pre-fill removed, both apps now require typing the console-logged code) — see
`apps/client/lib/features/onboarding/otp_screen.dart` and the driver equivalent.

Separately, the user asked to stop hand-rolling OTP delivery entirely and adopt Firebase Phone
Auth. This spec covers that migration.

## Current state (verified in code, not assumed)

`OtpPurpose` enum (`backend/prisma/schema.prisma`) has 4 values, but only 2 have real business
logic wired in `AuthService`:

- `registration` — used end-to-end today (both apps' OTP screen → `verifyOtp` → `register()`).
- `phone_verification` — same handler as `registration` in `AuthService.verifyOtp` (marks
  `isVerified: true`), but no app screen calls it yet.
- `login` — enum value only. Login is password-based (`POST /auth/login`); no OTP-based login
  endpoint exists.
- `password_reset` — enum value only. **No forgot-password feature exists at all** in the
  backend (no endpoint, no service method).

Decision (user): migrate all 4 purposes to Firebase Phone Auth. This means `registration` and
`phone_verification` are a genuine migration of existing behavior, while OTP-based login and
password reset are **new features** built on top of Firebase from day one (they don't exist in
any form today).

## Architecture

Firebase Phone Auth is client-driven: the Firebase SDK (not our backend) sends the SMS and
performs the verification. This rules out a simple "swap the `OtpProvider` implementation"
approach — the send/verify step moves out of our backend entirely.

New flow for any purpose that needs phone proof:

1. App calls Firebase client SDK `verifyPhoneNumber()` (via a shared `PhoneAuthService` wrapper in
   `packages/kaya_core`).
2. User receives the SMS from Firebase/Google (or, in dev, uses the whitelisted test number) and
   enters the code.
3. Firebase returns a signed **ID token** proving phone ownership.
4. The app sends that ID token to the backend alongside the relevant request:
   - `POST /auth/register` gains a `firebaseIdToken` field — replaces the current
     `POST /auth/otp/send` + `POST /auth/otp/verify` round-trip for registration.
   - New `POST /auth/login/otp` (phone + `firebaseIdToken`) for OTP-based login.
   - New `POST /auth/password-reset` (phone + `firebaseIdToken` + new password) for reset.
5. Backend verifies the ID token via **Firebase Admin SDK**, cross-checks the token's phone claim
   against the phone submitted in the request (reject on mismatch), then proceeds with the
   existing business logic (create user / issue JWT pair / update password).

`OtpService`, `DevOtpProvider`, the `otp_codes` table, and `/auth/otp/send` + `/auth/otp/verify`
are removed entirely once this lands — no purpose still needs them.

## Components touched

- **Firebase project** (`kaya-a24e7`, Spark/free plan) — done: 2 Android apps registered
  (`com.kaya.kaya_client`, `com.kaya.kaya_driver`), `google-services.json` in place for both,
  Phone provider enabled, dev test number `+233201234567` → `123456` registered (bypasses real
  SMS and the 10/day free quota).
- **`packages/kaya_core`**: add `firebase_core` + `firebase_auth` deps; new `PhoneAuthService`
  (send code, confirm code, return ID token) shared by both apps so there's one implementation to
  test and maintain.
- **`apps/client`, `apps/driver`**: `main.dart` gains `Firebase.initializeApp()`; `otp_screen.dart`
  rewritten to call `PhoneAuthService` instead of `kayaApi.auth.sendOtp`/`verifyOtp`; new login-by-
  OTP screen; new password-reset screen. `register()` call gains `firebaseIdToken`.
- **`backend`**: add `firebase-admin` package; init with `FIREBASE_SERVICE_ACCOUNT` (env var
  already exists in `env.schema.ts`, previously unused — was added for FCM, now dual-purposed).
  `AuthService.register()` verifies the token before creating the user. New
  `AuthService.loginWithOtp()` and `AuthService.resetPassword()`. Remove `OtpModule`/`OtpService`/
  `DevOtpProvider`/`otp-provider.interface.ts`. New Prisma migration to drop `otp_codes`.
- **Tests**: `otp.service.spec.ts` and the OTP parts of `auth.service.spec.ts`/`auth.e2e-spec.ts`
  are replaced with tests that mock Firebase Admin's `verifyIdToken`. New coverage for
  login-by-OTP and password-reset (money/auth-adjacent paths — required before merge per
  `CLAUDE.md`).

## Dev/CI without real SMS

Firebase's own **test phone numbers** feature (already configured: `+233201234567` → `123456`)
covers local dev and CI without touching real SMS or needing a Google Cloud billing account —
satisfies the `CLAUDE.md` rule that external integrations stay usable without real keys/costs in
dev. No emulator suite needed for this.

## Known gaps / follow-ups (not blocking, flagged for later)

1. **Android SHA-1 fingerprint**: Firebase's console warns that real (non-test) phone numbers on
   Android need the app's SHA-1 (debug + release keystore) registered, or verification falls back
   to Play Integrity/reCAPTCHA. Not needed for dev with the whitelisted test number; needed before
   testing with a real Ghanaian/Togolese/Beninese number on a real device.
2. **SMS deliverability/cost in Togo/Benin**: unverified. Ghana carrier coverage for Firebase
   Phone Auth is well documented; Francophone West Africa less so. Worth a short spike before
   fully committing, same pattern as the Paystack/Kkiapay risk spike already planned for M3.
3. **iOS app not yet registered** in Firebase (only the 2 Android apps so far) — needed before iOS
   builds can use Phone Auth.
4. This is a **BLUEPRINT deviation** from the M1 milestone ("OTP mock SMS en dev"), which was
   ~90% complete per prior session notes. Needs a `Decisions log` entry in `BLUEPRINT.md`.

## Out of scope

- Firebase for anything other than phone verification (no Firestore, no Firebase Hosting, no
  Analytics usage beyond what's on by default).
- Blaze plan / billing upgrade — stays on Spark (free) unless the 10 SMS/day dev quota becomes a
  real blocker.
