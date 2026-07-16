# Social login, 2FA, registration wizard, skeleton loading — design spec

Date: 2026-07-16
Status: approved by user, pending implementation plan
Builds on: `docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md` (Firebase Phone Auth migration, already implemented on this branch)

## Problem

Testing the Firebase Phone Auth migration on a real device surfaced `SMS unable to be sent until this region enabled by the app developer` — fixed separately (Firebase Console SMS region policy was in "Allow" mode with an empty region list; Ghana/Togo/Bénin added). Separately, the user requested four related but distinct pieces of new functionality:

1. Social sign-in/sign-up via Google and Facebook (Apple deferred — requires a paid Apple Developer account the user doesn't have yet).
2. Mandatory two-factor verification on password-based login (a code sent to the account's phone or email, on top of the password — closes the gap where a leaked password alone was sufficient).
3. A multi-step ("wizard") registration flow replacing the current single long form, shared in structure between the client and driver apps.
4. A skeleton-loading system for screens that load network data, across the whole app (not just auth).

## Current state (verified in code)

- `backend/prisma/schema.prisma` `User.passwordHash` is `String` (NOT NULL) — must become nullable for social-only accounts.
- `User.email` and `User.phone` are both `@unique` — usable as the account-linking key.
- `RedisService` (`backend/src/redis/redis.service.ts`) has `setValueEx`/`getValue`/`del` with graceful degradation (returns `null`/no-ops when Redis is unreachable). For the 2FA challenge, this degrades **fail-closed** by necessity — unlike the existing login-lockout counters (which fail open to "no lockout"), a missing challenge means the login literally cannot complete. This is a real risk if Redis is down; noted below, not solved here (same operational risk the app already accepts for driver GPS caching).
- `packages/kaya_core/pubspec.yaml` already has `firebase_core: ^3.6.0`, `firebase_auth: ^5.3.1`, `firebase_messaging: ^15.0.4`.
- `FirebaseAdminService.assertPhoneMatches` (`backend/src/auth/firebase-admin.service.ts`) is the only verification method today; a same-shaped `assertEmailMatches` (checking the token's `email` claim) is a natural sibling for this work.
- Firebase Console for project `kaya-a24e7`: `Adresse e-mail/Mot de passe` and `Téléphone` providers are enabled. Google/Facebook are not yet enabled. No Firebase Hosting site exists yet (needed for deep-link verification files).

## Architecture

Three independent-but-related auth flows, plus one UI system:

### Password login + mandatory 2FA

Every account has both a phone (mandatory at registration, including social sign-ups —
see wizard Step 3 below) and an email, so "channel" is not something the server can infer
from account shape. **The user picks the channel** on a "how would you like your code?"
screen after the password succeeds; the server accepts whichever proof arrives:

```
POST /auth/login {identifier, password}
  → verifies password (existing logic, existing lockout counters unchanged)
  → on success: generates challengeId, stores `login:challenge:{challengeId} = userId` in
    Redis (TTL 5 min), returns { challengeId } — NOT tokens.
  → app shows a channel picker (SMS / Email), then drives the matching Firebase flow:
      SMS   → PhoneAuthService.sendCode(user's phone) → user enters code →
              confirmCode() → firebaseIdToken
      Email → FirebaseAuth.instance.sendSignInLinkToEmail(...) → user clicks
              the link (opens the app via deep link, see below) →
              FirebaseAuth.instance.signInWithEmailLink(...) → firebaseIdToken
  → POST /auth/login/verify {challengeId, firebaseIdToken}
      → looks up userId from challengeId (400 if expired/missing — fails closed)
      → FirebaseAdminService.assertPhoneOrEmailMatches(idToken, user.phone, user.email) —
        accepts either claim, whichever the token carries; rejects if neither matches
      → deletes the challenge key (one-time use)
      → issues the normal token pair
```

### Social login (Google, Facebook)

`role`, `countryCode`, and `phone` are all `NOT NULL` on `User` today (and deliberately
stay that way — money-path code such as commission/pricing reads `countryCode`
unconditionally, and this work explicitly does not touch money-path logic). So a
brand-new social sign-up **cannot** get a `User` row before the wizard collects those
fields; there is no safe placeholder value. Two cases:

```
App: FirebaseAuth sign-in with GoogleAuthProvider / FacebookAuthProvider (via
     google_sign_in / flutter_facebook_auth packages driving the native OAuth flow,
     then handed to Firebase) → firebaseIdToken (proves a verified email)

POST /auth/social {firebaseIdToken, provider: 'google' | 'facebook'}
  → FirebaseAdminService.verifySocialToken(idToken) — decodes and verifies signature only
  → find user by decoded email
      - EXISTING account: log them in directly (issue tokens). No 2FA — the provider
        already verified identity, and this account already has phone/role/country from
        its original registration.
      - NO existing account: do NOT create a User row yet (would violate NOT NULL
        role/countryCode/phone with no honest value to put there). Instead issue a
        short-lived (15 min) signed "social draft" token — TokenService gains
        `issueSocialDraftToken({ email, fullName, provider })` (same RS256 key already
        used for access tokens, distinct `purpose: 'social_draft'` claim so it can never
        be accepted where an access token is expected) — and return
        { isNewAccount: true, socialDraftToken, email, fullName } with NO access/refresh
        tokens (the account doesn't exist yet, there is nothing to authenticate as).
```

The app routes a `isNewAccount: true` response into the registration wizard (Contact
step, name/email prefilled and locked). The wizard still collects role, country, and
**phone** (Step 3 still runs Firebase phone verification for social sign-ups — see
below), then submits once to `POST /auth/register` exactly like the classic path, except
the request carries `socialDraftToken` instead of `password`: `RegisterDto` accepts
`password` OR `socialDraftToken` (never neither, never both — enforced by a
`@ValidateIf` cross-field rule). `register()` branches: if `socialDraftToken` is present,
verify it (decode, check `purpose: 'social_draft'`, check its email matches
`dto.email`), skip password hashing (`passwordHash: null`), set `authProvider` from the
token's `provider` claim; otherwise unchanged (hash `dto.password`,
`authProvider: 'password'`). `firebaseIdToken` (phone proof) is required either way — the
wizard's Step 3 phone verification is not skipped for social sign-ups, only the password
step is.

### Registration wizard (client + driver, shared structure)

Four steps, one screen each, shared progress bar:

1. **Identité** — full name, role (client/livreur/both), country.
2. **Contact** — phone, email (prefilled + locked if arriving from social login).
3. **Sécurité** — password (skipped entirely if arriving from social login) + phone verification (Firebase `PhoneAuthService`, same flow as today's `otp_screen.dart`).
4. **Docs** (driver/both only) — license number, vehicle type/registration, document photos, per-country validation (existing `validateDriverFields`).

Submission model: **one final submit** at the end of step 4 (or step 3 for client-only) to `POST /auth/register`, matching today's shape — the wizard is purely a client-side UX restructuring of the existing single-shot `RegisterDto` payload, not a new multi-request backend flow. This holds for both the classic path (`password` set) and the social path (`socialDraftToken` set instead — see above); there is no separate "already authenticated, PATCH profile" branch, since a new social sign-up has no `User` row and no tokens until this single submit succeeds.

### Skeleton loading

A new `KayaSkeleton` widget family in `packages/kaya_core/lib/src/theme/widgets/`, built on the `shimmer` package, following the existing widget pattern (see `empty_state.dart`): a base `KayaSkeletonBox` (rect/circle shimmer placeholder) and composed presets (`KayaSkeletonListTile`, `KayaSkeletonCard`) for the concrete places identified: home order-history list, offers list, profile header, notifications list. Applied wherever those screens currently show a loading spinner while awaiting a network response.

## Backend changes

- `backend/prisma/schema.prisma`: `passwordHash String` → `String?`; add `authProvider AuthProvider @default(password)` enum (`password`, `google`, `facebook`, `apple`) for traceability; migration to alter the column and add the enum + column. `role`/`countryCode`/`phone` stay `NOT NULL` — unchanged (see Social login above for why).
- `FirebaseAdminService`: add `assertPhoneOrEmailMatches(idToken, expectedPhone, expectedEmail): Promise<void>` (accepts either claim present on the token) and `verifySocialToken(idToken): Promise<{ email: string; name?: string }>` (decode + verify signature only, no cross-check — the token's own claims ARE the identity for social sign-in).
- `TokenService`: add `issueSocialDraftToken({ email, fullName, provider }): Promise<string>` and `verifySocialDraftToken(token): Promise<{ email, fullName, provider }>` — short-lived (15 min), same signing key, distinct `purpose` claim so it's rejected anywhere an access/refresh token is expected.
- `AuthService.login()`: split into challenge-issuing (current password check, minus final token issuance) + new `verifyLoginChallenge()`.
- New `AuthController` routes: `POST /auth/login/verify`, `POST /auth/social`.
- `RegisterDto`: `password` becomes `@IsOptional()`; new optional `socialDraftToken` field; a `@ValidateIf` cross-field rule enforces exactly one of the two is present. `register()` branches on which is set (see Social login above).

## Firebase Console changes

- Enable **Google** and **Facebook** sign-in providers (Authentication > Méthode de connexion). Facebook requires a Meta for Developers App ID/secret the user must create and hand over — cannot be done by the agent.
- Enable **Email Link sign-in** (a mode of the existing Email/Password provider).
- Create a **Firebase Hosting** site on `kaya-a24e7` to serve `.well-known/assetlinks.json` (Android App Links) and `.well-known/apple-app-site-association` (iOS Universal Links), both required for the email magic-link to reopen the app instead of a bare browser tab.

## Flutter changes

- `packages/kaya_core/pubspec.yaml`: add `google_sign_in`, `flutter_facebook_auth`, `shimmer`.
- `FirebaseAdminService`-equivalent client wrapper additions to `phone_auth_service.dart`'s sibling: new `EmailLinkAuthService` (send link, complete sign-in) and `SocialAuthService` (Google/Facebook sign-in, returns `firebaseIdToken`).
- New `RegisterWizardController` (Riverpod `StateNotifier`) holding the in-progress draft across the 4 steps; one screen widget per step under `features/onboarding/wizard/`.
- New `KayaSkeleton` widgets in `kaya_core` as described above; applied to the four identified list/detail screens per app.
- Android: `AndroidManifest.xml` intent-filter (`autoVerify="true"`) for the Hosting domain. iOS: `Runner.entitlements` associated domains entry. Cannot be verified end-to-end without a physical device — code lands, verification is a manual QA step for the user.

## Risks / explicitly out of scope

1. **Apple Sign-In** deferred — no Apple Developer account yet. `authProvider` enum includes `apple` so the DB doesn't need another migration when it's added later.
2. **Facebook App creation** is a manual step for the user (Meta for Developers account) — cannot be automated by the agent.
3. **Deep link on-device verification** — code and config land, but actually clicking a magic-link email on a real Android/iOS device and confirming the app reopens is a manual QA step; this environment has no attached device.
4. **Redis-down fail-closed risk on 2FA login** — if Redis is unreachable when a login challenge is issued or checked, the login cannot complete (unlike the existing lockout counters, which fail open). Accepted as consistent with the app's existing Redis-dependency posture; not mitigated further here.
5. Not in scope: Apple Sign-In implementation itself, Facebook App provisioning, any change to the existing OTP-based registration/phone-verification flow (Firebase Phone Auth migration, already shipped) beyond what's needed to slot into the wizard.

## Out of scope

- Skeleton loading is scoped to the four screens identified above for this pass (home order-history, offers, profile header, notifications) — not a blanket audit of every loading spinner in the app. This is the agent's own YAGNI-driven scoping, not something the user explicitly confirmed — flagged for the user's review below; more screens can be added later without architectural change (the widgets are reusable).
- No backend change to money/escrow/commission paths — this work is entirely auth/profile/UI.
