# Wave 2a — Mandatory 2FA login + Social sign-in (Flutter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Flutter side of the already-shipped Wave 1 backend (`POST /auth/login` → challenge, `POST /auth/login/verify`, `POST /auth/social`) into both apps: password login becomes two-step (password, then a phone-or-email code), and Google/Facebook sign-in buttons appear on the login screen. The standalone "log in by code" screen is removed — the code is now an automatic step of the classic login, not a separate mode.

**Architecture:** `kaya_core`'s `KayaApi.AuthApi` and result models change shape first (Task 1), then a new `SocialAuthService`/`EmailLinkAuthService` pair of thin SDK wrappers is added (Task 2, mirrors the existing `PhoneAuthService` pattern), then each app's `AuthController` and onboarding screens are updated to match (Tasks 3 and 4, one per app, since screens are duplicated per app in this codebase — only `kaya_core` is shared).

**Tech Stack:** Flutter 3.22+, Riverpod (`StateNotifier`), `go_router`, `dio`, `firebase_auth`, new: `google_sign_in`, `flutter_facebook_auth`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-social-login-2fa-wizard-design.md`. Backend (Wave 1) is already shipped and unchanged by this plan — do not touch anything under `backend/`.
- This wave does **not** build the registration wizard (that's `docs/superpowers/plans/2026-07-16-wave2b-registration-wizard.md`, a separate plan that must land after this one). Where a new-account social sign-up needs to continue into registration, this plan navigates to the existing `/register` route with the draft data as `extra` — Wave 2b's wizard is what actually consumes that `extra` shape (documented below, Task 3/Task 4's Interfaces block) once it replaces `/register`. Until Wave 2b lands, that `extra` payload is simply unused by the (old, single-form) `RegisterScreen` — harmless, not a regression.
- `KayaApi.AuthApi.loginWithOtp` (kaya_core) and the backend `POST /auth/login/otp` route are **not deleted** by this plan — only the app-level `LoginOtpScreen` (the only caller) and the app-level `AuthController.loginWithOtp` wrapper are removed, since those become genuinely dead code once the screen is gone. The kaya_core API method and the backend route are left in place as they still mirror a live, testable backend capability; removing them is a separate decision for whoever owns that endpoint's future, not something this Flutter-scoped wave should decide unilaterally.
- The email 2FA/verification channel's code lands in full (per spec), but — per the spec's Risk #3 — it cannot be exercised end-to-end in this environment: it needs a Firebase Hosting site serving the deep-link well-known files (not created yet) and a physical Android/iOS device (none attached here). Every task that touches the email channel says so again at the point it applies. The SMS channel is fully verifiable today (it already works — Firebase Phone Auth is shipped and tested on real devices per the migration this builds on).
- Code + comments in English. UI strings via `KayaL10n` (`packages/kaya_core/lib/src/l10n/kaya_l10n.dart`), FR first.
- Every task must leave `cd packages/kaya_core && flutter analyze` and `flutter test` clean (kaya_core has plain `dart`/`flutter_test` unit tests under `packages/kaya_core/test/`, no widget tests since it has no widgets that build a `MaterialApp` — see Task 1/2), and `cd apps/client && flutter analyze` / `cd apps/driver && flutter analyze` clean after their respective tasks. Widget tests for the two apps live under `apps/client/test/` and `apps/driver/test/`.

---

### Task 1: `kaya_core` — challenge/social-login models + `KayaApi.AuthApi`

**Files:**
- Modify: `packages/kaya_core/lib/src/models/auth_result.dart`
- Modify: `packages/kaya_core/lib/src/api/kaya_api.dart` (`AuthApi.login`, new `AuthApi.verifyLoginChallenge`, new `AuthApi.socialLogin`)
- Create: `packages/kaya_core/test/social_login_test.dart`

**Interfaces:**
- Produces: `LoginChallenge.fromJson`, `SocialLoginOutcome` (sealed: `SocialLoginSuccess(AuthResult result)` | `SocialSignupRequired(String socialDraftToken, String email, String? fullName)`). Tasks 3/4 depend on this exact shape — in particular, `SocialSignupRequired`'s three fields are exactly what gets passed as `/register`'s route `extra` for Wave 2b to pick up later.
- Produces: `AuthApi.login(identifier, password) -> Future<LoginChallenge>` (changed return type — was `Future<AuthResult>`), `AuthApi.verifyLoginChallenge({challengeId, firebaseIdToken}) -> Future<AuthResult>`, `AuthApi.socialLogin({firebaseIdToken, provider}) -> Future<SocialLoginOutcome>`.

- [ ] **Step 1: Write the failing tests**

Create `packages/kaya_core/test/social_login_test.dart`:

```dart
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_core/kaya_core.dart';

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);
  final ResponseBody Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async =>
      handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Map<String, dynamic> body, int status) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

KayaApi _apiWith(ResponseBody Function(RequestOptions) handler) {
  final config = ApiConfig(restBaseUrl: 'http://test.local/api/v1', socketBaseUrl: 'http://test.local');
  final api = KayaApi(config: config, store: InMemoryTokenStore());
  api.raw.httpClientAdapter = _FakeAdapter(handler);
  return api;
}

void main() {
  group('AuthApi.login', () {
    test('returns a LoginChallenge, not tokens', async () async {
      final api = _apiWith((options) {
        expect(options.path, '/auth/login');
        return _json({'challengeId': 'chal-123'}, 200);
      });
      final result = await api.auth.login('kofi@example.com', 'SecurePass123!');
      expect(result.challengeId, 'chal-123');
    });
  });

  group('AuthApi.verifyLoginChallenge', () {
    test('returns full AuthResult on success', async () async {
      final api = _apiWith((options) {
        expect(options.path, '/auth/login/verify');
        expect(options.data, {'challengeId': 'chal-123', 'firebaseIdToken': 'tok'});
        return _json({
          'accessToken': 'a1',
          'refreshToken': 'r1',
          'user': {
            'id': 'u1',
            'email': 'kofi@example.com',
            'phone': '+233201234567',
            'fullName': 'Kofi',
            'role': 'client',
            'countryCode': 'GHA',
          },
        }, 200);
      });
      final result = await api.auth.verifyLoginChallenge(
        challengeId: 'chal-123',
        firebaseIdToken: 'tok',
      );
      expect(result.tokens.accessToken, 'a1');
      expect(result.user?.email, 'kofi@example.com');
    });
  });

  group('AuthApi.socialLogin', () {
    test('maps an existing-account response to SocialLoginSuccess', async () async {
      final api = _apiWith((options) {
        expect(options.path, '/auth/social');
        expect(options.data, {'firebaseIdToken': 'tok', 'provider': 'google'});
        return _json({
          'accessToken': 'a1',
          'refreshToken': 'r1',
          'user': {
            'id': 'u1',
            'email': 'kofi@example.com',
            'phone': '+233201234567',
            'fullName': 'Kofi',
            'role': 'client',
            'countryCode': 'GHA',
          },
        }, 200);
      });
      final outcome = await api.auth.socialLogin(firebaseIdToken: 'tok', provider: 'google');
      expect(outcome, isA<SocialLoginSuccess>());
      expect((outcome as SocialLoginSuccess).result.tokens.accessToken, 'a1');
    });

    test('maps a new-account response to SocialSignupRequired', async () async {
      final api = _apiWith((options) => _json({
            'isNewAccount': true,
            'socialDraftToken': 'draft-token',
            'email': 'new@example.com',
            'fullName': 'New Person',
          }, 200));
      final outcome = await api.auth.socialLogin(firebaseIdToken: 'tok', provider: 'facebook');
      expect(outcome, isA<SocialSignupRequired>());
      final draft = outcome as SocialSignupRequired;
      expect(draft.socialDraftToken, 'draft-token');
      expect(draft.email, 'new@example.com');
      expect(draft.fullName, 'New Person');
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/kaya_core && flutter test test/social_login_test.dart`
Expected: FAIL — compile error, `LoginChallenge`/`SocialLoginOutcome`/`AuthApi.verifyLoginChallenge`/`AuthApi.socialLogin` don't exist, and `AuthApi.login`'s current return type is `AuthResult` not `LoginChallenge`.

- [ ] **Step 3: Add the models**

In `packages/kaya_core/lib/src/models/auth_result.dart`, add after the existing `AuthResult` class:

```dart
/// Response to `POST /auth/login`: a redeemable 2FA challenge, not tokens.
class LoginChallenge {
  const LoginChallenge({required this.challengeId});

  final String challengeId;

  factory LoginChallenge.fromJson(Map<String, dynamic> j) =>
      LoginChallenge(challengeId: asString(j['challengeId']));
}

/// Response to `POST /auth/social`: either an existing account is logged in
/// directly, or the email has no account yet and registration must continue
/// via the wizard (see the `2026-07-16-wave2b-registration-wizard` plan).
sealed class SocialLoginOutcome {
  factory SocialLoginOutcome.fromJson(Map<String, dynamic> j) {
    if (j['isNewAccount'] == true) {
      return SocialSignupRequired(
        socialDraftToken: asString(j['socialDraftToken']),
        email: asString(j['email']),
        fullName: asStringOrNull(j['fullName']),
      );
    }
    return SocialLoginSuccess(AuthResult.fromJson(j));
  }
}

class SocialLoginSuccess implements SocialLoginOutcome {
  const SocialLoginSuccess(this.result);
  final AuthResult result;
}

/// No `User` row exists yet for this email — the app must route into the
/// registration wizard with these three fields (name/email prefilled and
/// locked, per spec) rather than showing the classic register form.
class SocialSignupRequired implements SocialLoginOutcome {
  const SocialSignupRequired({
    required this.socialDraftToken,
    required this.email,
    this.fullName,
  });
  final String socialDraftToken;
  final String email;
  final String? fullName;
}
```

Add `asStringOrNull` to the import if `auth_result.dart` doesn't already import it from `json_utils.dart` (check the top of the file — `asString` is already imported from there; add `asStringOrNull` to the same `import 'json_utils.dart';` line's usage, no new import needed since it's the same file).

- [ ] **Step 4: Update `AuthApi`**

In `packages/kaya_core/lib/src/api/kaya_api.dart`, replace the `login` method and add two new ones (right after it):

```dart
  Future<LoginChallenge> login(String identifier, String password) async =>
      LoginChallenge.fromJson(await _api._postMap('/auth/login',
          body: {'identifier': identifier, 'password': password},
          skipAuth: true));

  Future<AuthResult> verifyLoginChallenge({
    required String challengeId,
    required String firebaseIdToken,
  }) async =>
      AuthResult.fromJson(await _api._postMap('/auth/login/verify',
          body: {'challengeId': challengeId, 'firebaseIdToken': firebaseIdToken},
          skipAuth: true));

  Future<SocialLoginOutcome> socialLogin({
    required String firebaseIdToken,
    required String provider,
  }) async =>
      SocialLoginOutcome.fromJson(await _api._postMap('/auth/social',
          body: {'firebaseIdToken': firebaseIdToken, 'provider': provider},
          skipAuth: true));
```

(`loginWithOtp`, just below, is unchanged — see Global Constraints.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/kaya_core && flutter test test/social_login_test.dart && flutter analyze`
Expected: All 4 tests pass, `flutter analyze` clean. This will also break the *callers* of `AuthApi.login` (both apps' `auth_provider.dart` still expect an `AuthResult`) — that's expected and fixed in Tasks 3/4; `kaya_core`'s own `flutter analyze` is unaffected since it has no dependency on the apps.

- [ ] **Step 6: Commit**

```bash
git add packages/kaya_core/lib/src/models/auth_result.dart packages/kaya_core/lib/src/api/kaya_api.dart packages/kaya_core/test/social_login_test.dart
git commit -m "feat(kaya_core): AuthApi.login returns a 2FA challenge; add verifyLoginChallenge and socialLogin"
```

---

### Task 2: `kaya_core` — `SocialAuthService` + `EmailLinkAuthService`

**Files:**
- Create: `packages/kaya_core/lib/src/services/social_auth_service.dart`
- Create: `packages/kaya_core/lib/src/services/email_link_auth_service.dart`
- Modify: `packages/kaya_core/lib/kaya_core.dart` (export the two new files)
- Modify: `packages/kaya_core/pubspec.yaml` (add `google_sign_in`, `flutter_facebook_auth`)

**Interfaces:**
- Produces: `abstract interface class SocialAuthService { Future<String?> signIn(SocialProvider provider); }` and `enum SocialProvider { google, facebook }` — `null` return means the user cancelled the native picker (not an error). Tasks 3/4 depend on this signature.
- Produces: `abstract interface class EmailLinkAuthService { Future<void> sendSignInLink({required String email, required String continueUrl, required String androidPackageName, required String iosBundleId}); bool isSignInLink(String link); Future<String> completeSignIn({required String email, required String emailLink}); }`. Tasks 3/4 depend on this signature.

There is no dedicated test file for either service in this task — this mirrors the existing `PhoneAuthService`/`FirebasePhoneAuthService` pair (`packages/kaya_core/lib/src/services/phone_auth_service.dart`), which also has no unit test, because both are thin wrappers around a real OAuth/Firebase SDK call that cannot be exercised without live provider credentials and (for Google/Facebook specifically) a real device or emulator with Play Services / the Facebook app. The interfaces above exist precisely so Tasks 3/4's *screens* can be widget-tested against a fake implementation — that's where the test coverage for this behavior lives.

- [ ] **Step 1: Add the dependencies**

In `packages/kaya_core/pubspec.yaml`, add to the `dependencies:` block, right after the existing `firebase_auth: ^5.3.1` line:

```yaml
  google_sign_in: ^6.2.1
  flutter_facebook_auth: ^7.0.1
```

Run: `cd packages/kaya_core && flutter pub get`
Expected: resolves cleanly (both packages support the `firebase_core`/`firebase_auth` versions already pinned).

- [ ] **Step 2: Write `SocialAuthService`**

```dart
// packages/kaya_core/lib/src/services/social_auth_service.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

enum SocialProvider { google, facebook }

/// Wraps the native Google/Facebook sign-in SDKs so onboarding screens never
/// touch them directly (mirrors PhoneAuthService's role for phone auth). A
/// `null` return means the user cancelled the native picker — not an error.
abstract interface class SocialAuthService {
  Future<String?> signIn(SocialProvider provider);
}

class FirebaseSocialAuthService implements SocialAuthService {
  FirebaseSocialAuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;

  @override
  Future<String?> signIn(SocialProvider provider) async {
    final credential = switch (provider) {
      SocialProvider.google => await _googleCredential(),
      SocialProvider.facebook => await _facebookCredential(),
    };
    if (credential == null) return null;
    final result = await _auth.signInWithCredential(credential);
    return result.user?.getIdToken();
  }

  Future<AuthCredential?> _googleCredential() async {
    final googleUser = await GoogleSignIn().signIn();
    if (googleUser == null) return null;
    final googleAuth = await googleUser.authentication;
    return GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
  }

  Future<AuthCredential?> _facebookCredential() async {
    final result = await FacebookAuth.instance.login();
    if (result.status != LoginStatus.success || result.accessToken == null) return null;
    return FacebookAuthProvider.credential(result.accessToken!.tokenString);
  }
}
```

- [ ] **Step 3: Write `EmailLinkAuthService`**

```dart
// packages/kaya_core/lib/src/services/email_link_auth_service.dart
import 'package:firebase_auth/firebase_auth.dart';

/// Wraps Firebase's email-link ("magic link") sign-in. The Android package
/// name and iOS bundle ID differ between the client and driver apps, so
/// callers supply them rather than this shared service hardcoding one.
///
/// NOTE: exercising this end-to-end requires a Firebase Hosting site serving
/// the deep-link well-known files and a physical device — neither exists yet
/// in this environment (spec Risk #3). The code is correct against the
/// Firebase Auth API; on-device verification is a manual QA step.
abstract interface class EmailLinkAuthService {
  Future<void> sendSignInLink({
    required String email,
    required String continueUrl,
    required String androidPackageName,
    required String iosBundleId,
  });

  bool isSignInLink(String link);

  Future<String> completeSignIn({required String email, required String emailLink});
}

class FirebaseEmailLinkAuthService implements EmailLinkAuthService {
  FirebaseEmailLinkAuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;

  @override
  Future<void> sendSignInLink({
    required String email,
    required String continueUrl,
    required String androidPackageName,
    required String iosBundleId,
  }) {
    return _auth.sendSignInLinkToEmail(
      email: email,
      actionCodeSettings: ActionCodeSettings(
        url: continueUrl,
        handleCodeInApp: true,
        androidPackageName: androidPackageName,
        androidInstallApp: true,
        androidMinimumVersion: '21',
        iOSBundleId: iosBundleId,
      ),
    );
  }

  @override
  bool isSignInLink(String link) => _auth.isSignInWithEmailLink(link);

  @override
  Future<String> completeSignIn({required String email, required String emailLink}) async {
    final result = await _auth.signInWithEmailLink(email: email, emailLink: emailLink);
    final idToken = await result.user?.getIdToken();
    if (idToken == null) {
      throw StateError('Firebase did not return an ID token.');
    }
    return idToken;
  }
}
```

- [ ] **Step 4: Export both from the package barrel**

In `packages/kaya_core/lib/kaya_core.dart`, add next to the existing `export 'src/services/phone_auth_service.dart';` line:

```dart
export 'src/services/social_auth_service.dart';
export 'src/services/email_link_auth_service.dart';
```

- [ ] **Step 5: Verify**

Run: `cd packages/kaya_core && flutter analyze && flutter test`
Expected: clean, all existing + Task 1's tests pass (no test added in this task, per the note above).

- [ ] **Step 6: Commit**

```bash
git add packages/kaya_core/pubspec.yaml packages/kaya_core/pubspec.lock packages/kaya_core/lib/src/services/social_auth_service.dart packages/kaya_core/lib/src/services/email_link_auth_service.dart packages/kaya_core/lib/kaya_core.dart
git commit -m "feat(kaya_core): add SocialAuthService (Google/Facebook) and EmailLinkAuthService wrappers"
```

---

### Task 3: Client app — two-step login, social buttons, remove standalone login-by-code

**Files:**
- Modify: `apps/client/lib/providers/auth_provider.dart`
- Modify: `apps/client/lib/features/onboarding/login_screen.dart`
- Create: `apps/client/lib/features/onboarding/login_verify_screen.dart`
- Delete: `apps/client/lib/features/onboarding/login_otp_screen.dart`
- Modify: `apps/client/lib/router.dart`
- Modify: `packages/kaya_core/lib/src/l10n/kaya_l10n.dart` (new strings — shared file, but this task owns the specific keys it adds; Task 4 adds its own driver-only keys separately, no collision since keys are additive)
- Create: `apps/client/test/login_flow_test.dart`

**Interfaces:**
- Consumes: `LoginChallenge`, `SocialLoginOutcome`/`SocialLoginSuccess`/`SocialSignupRequired` (Task 1); `SocialAuthService`, `SocialProvider`, `EmailLinkAuthService` (Task 2).
- Produces: `AuthController.login(identifier, password) -> Future<LoginChallenge>` (return type changed — was `Future<void>`), new `AuthController.verifyLogin({challengeId, firebaseIdToken}) -> Future<void>`, new `AuthController.socialLogin(firebaseIdToken, provider) -> Future<SocialLoginOutcome>`. `AuthController.loginWithOtp` is **removed** (its only caller, `LoginOtpScreen`, is deleted in this same task).
- On `SocialSignupRequired`, the login screen navigates to `/register` with `extra: SocialSignupExtra(socialDraftToken: ..., email: ..., fullName: ...)` — a tiny new class defined in this task, in `login_screen.dart` itself (it's UI-layer routing glue, not a shared model). Wave 2b's wizard plan will read this exact class/shape when it replaces `/register`'s builder.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/login_flow_test.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/providers/auth_provider.dart';
import 'package:kaya_client/providers/core_providers.dart';
import 'package:kaya_core/kaya_core.dart';

class _FakeAuthApi extends AuthApi {
  _FakeAuthApi(KayaApi api) : super(api);
}

void main() {
  test('login() returns a LoginChallenge without authenticating', async () async {
    final container = ProviderContainer(overrides: [
      kayaApiProvider.overrideWith((ref) => _StubApi()),
      tokenStoreProvider.overrideWith((ref) => InMemoryTokenStore()),
    ]);
    addTearDown(container.dispose);

    final controller = container.read(authControllerProvider.notifier);
    final challenge = await controller.login('kofi@example.com', 'SecurePass123!');

    expect(challenge.challengeId, 'chal-1');
    expect(container.read(authControllerProvider).isAuthenticated, isFalse);
  });

  test('verifyLogin() authenticates on a valid challenge', async () async {
    final container = ProviderContainer(overrides: [
      kayaApiProvider.overrideWith((ref) => _StubApi()),
      tokenStoreProvider.overrideWith((ref) => InMemoryTokenStore()),
    ]);
    addTearDown(container.dispose);

    final controller = container.read(authControllerProvider.notifier);
    await controller.verifyLogin(challengeId: 'chal-1', firebaseIdToken: 'tok');

    expect(container.read(authControllerProvider).isAuthenticated, isTrue);
  });

  test('socialLogin() authenticates immediately for an existing account', async () async {
    final container = ProviderContainer(overrides: [
      kayaApiProvider.overrideWith((ref) => _StubApi()),
      tokenStoreProvider.overrideWith((ref) => InMemoryTokenStore()),
    ]);
    addTearDown(container.dispose);

    final controller = container.read(authControllerProvider.notifier);
    final outcome = await controller.socialLogin('tok', 'google');

    expect(outcome, isA<SocialLoginSuccess>());
    expect(container.read(authControllerProvider).isAuthenticated, isTrue);
  });

  test('socialLogin() does not authenticate for a brand-new account', async () async {
    final container = ProviderContainer(overrides: [
      kayaApiProvider.overrideWith((ref) => _StubApi(newAccount: true)),
      tokenStoreProvider.overrideWith((ref) => InMemoryTokenStore()),
    ]);
    addTearDown(container.dispose);

    final controller = container.read(authControllerProvider.notifier);
    final outcome = await controller.socialLogin('tok', 'facebook');

    expect(outcome, isA<SocialSignupRequired>());
    expect(container.read(authControllerProvider).isAuthenticated, isFalse);
  });
}

/// Minimal KayaApi stand-in: only auth.* is exercised by this test file, so
/// only auth.* is stubbed. Other domain groups are never called.
class _StubApi extends KayaApi {
  _StubApi({this.newAccount = false})
      : super(config: ApiConfig(restBaseUrl: 'http://test.local', socketBaseUrl: 'http://test.local'),
            store: InMemoryTokenStore());
  final bool newAccount;

  @override
  late final auth = _StubAuthApi(this, newAccount);
}

class _StubAuthApi extends AuthApi {
  _StubAuthApi(super.api, this.newAccount);
  final bool newAccount;

  @override
  Future<LoginChallenge> login(String identifier, String password) async =>
      const LoginChallenge(challengeId: 'chal-1');

  @override
  Future<AuthResult> verifyLoginChallenge({required String challengeId, required String firebaseIdToken}) async =>
      const AuthResult(
        tokens: AuthTokens(accessToken: 'a1', refreshToken: 'r1'),
        user: User(
          id: 'u1',
          email: 'kofi@example.com',
          phone: '+233201234567',
          fullName: 'Kofi',
          role: UserRole.client,
          countryCode: CountryCode.GHA,
        ),
      );

  @override
  Future<SocialLoginOutcome> socialLogin({required String firebaseIdToken, required String provider}) async {
    if (newAccount) {
      return const SocialSignupRequired(
        socialDraftToken: 'draft', email: 'new@example.com', fullName: 'New Person');
    }
    return SocialLoginSuccess(await verifyLoginChallenge(challengeId: 'x', firebaseIdToken: firebaseIdToken));
  }

  @override
  Future<User> me() async => throw UnimplementedError();
}
```

(`kaya_client` is this app's package name — check `apps/client/pubspec.yaml`'s `name:` field matches; if it's different, use that name in the two `import 'package:kaya_client/...'` lines.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/client && flutter test test/login_flow_test.dart`
Expected: FAIL — `AuthController.login` currently returns `Future<void>` and authenticates directly; `verifyLogin`/`socialLogin` don't exist yet.

- [ ] **Step 3: Rewrite `AuthController`**

In `apps/client/lib/providers/auth_provider.dart`, replace `login` and `loginWithOtp`:

```dart
  Future<LoginChallenge> login(String identifier, String password) async {
    return _api.auth.login(identifier, password);
  }

  Future<void> verifyLogin({required String challengeId, required String firebaseIdToken}) async {
    final result = await _api.auth.verifyLoginChallenge(
      challengeId: challengeId,
      firebaseIdToken: firebaseIdToken,
    );
    await _store.save(result.tokens);
    final user = result.user ?? await _api.auth.me();
    _connectSocket(result.tokens.accessToken);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<SocialLoginOutcome> socialLogin(String firebaseIdToken, String provider) async {
    final outcome = await _api.auth.socialLogin(firebaseIdToken: firebaseIdToken, provider: provider);
    if (outcome is SocialLoginSuccess) {
      final result = outcome.result;
      await _store.save(result.tokens);
      final user = result.user ?? await _api.auth.me();
      _connectSocket(result.tokens.accessToken);
      state = AuthState(status: AuthStatus.authenticated, user: user);
    }
    return outcome;
  }
```

(Delete the old `loginWithOtp` method entirely — its only caller is deleted in Step 6.)

- [ ] **Step 4: Add the l10n strings**

In `packages/kaya_core/lib/src/l10n/kaya_l10n.dart`, add after the existing `authResetPasswordSuccess` getter:

```dart
  String get authOrContinueWith => _t('ou continuer avec', 'or continue with');
  String get authContinueWithGoogle => _t('Continuer avec Google', 'Continue with Google');
  String get authContinueWithFacebook => _t('Continuer avec Facebook', 'Continue with Facebook');
  String get authVerifyTitle => _t('Vérification en 2 étapes', 'Two-step verification');
  String get authVerifySubtitle => _t(
      'Choisissez comment recevoir votre code.', 'Choose how to receive your code.');
  String get authChannelSms => _t('Par SMS', 'By SMS');
  String get authChannelEmail => _t('Par e-mail', 'By email');
  String get authEmailLinkSent => _t(
      'Lien envoyé. Ouvrez-le depuis cet appareil pour continuer.',
      'Link sent. Open it from this device to continue.');
```

Remove the now-unused `authLoginOtp` getter only if nothing else references it — check first: `grep -rn "authLoginOtp" apps/ packages/` after Step 6 deletes its only caller, then remove the getter here if the grep comes back empty (it's shared with the driver app, whose Task 4 removes its own caller — do not remove this getter until Task 4 also lands, since removing it early would break the driver app's still-existing `LoginOtpScreen` reference mid-wave; leave a `// TODO(wave-2a): remove once both apps' LoginOtpScreen are gone` note here for now, and delete the getter for real as the last step of Task 4).

- [ ] **Step 5: Write `LoginVerifyScreen`**

```dart
// apps/client/lib/features/onboarding/login_verify_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

enum _Channel { none, sms, email }

/// Shown right after a successful password check. The user picks SMS or
/// email, then supplies whichever proof Firebase asks for.
class LoginVerifyScreen extends ConsumerStatefulWidget {
  const LoginVerifyScreen({super.key, required this.challengeId, required this.phone, required this.email});

  final String challengeId;
  final String phone;
  final String email;

  @override
  ConsumerState<LoginVerifyScreen> createState() => _LoginVerifyScreenState();
}

class _LoginVerifyScreenState extends ConsumerState<LoginVerifyScreen> {
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  final _emailAuth = FirebaseEmailLinkAuthService();
  _Channel _channel = _Channel.none;
  String? _verificationId;
  bool _emailLinkSent = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _pickSms() async {
    setState(() {
      _channel = _Channel.sms;
      _busy = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: widget.phone,
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _busy = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _busy = false;
      }),
    );
  }

  Future<void> _pickEmail() async {
    setState(() {
      _channel = _Channel.email;
      _busy = true;
      _error = null;
    });
    try {
      await _emailAuth.sendSignInLink(
        email: widget.email,
        continueUrl: 'https://kaya-a24e7.web.app/login-verify',
        androidPackageName: 'com.kaya.kaya_client',
        iosBundleId: 'com.kaya.kayaClient',
      );
      setState(() => _emailLinkSent = true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifySms() async {
    if (_verificationId == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref.read(authControllerProvider.notifier).verifyLogin(
            challengeId: widget.challengeId,
            firebaseIdToken: idToken,
          );
      if (mounted) context.go('/home');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authVerifyTitle, style: AppTypography.screenTitle),
            const SizedBox(height: 8),
            Text(l10n.authVerifySubtitle, style: AppTypography.bodySecondary),
            const SizedBox(height: 24),
            if (_channel == _Channel.none) ...[
              KayaButton(
                label: l10n.authChannelSms,
                icon: Icons.sms_outlined,
                variant: KayaButtonVariant.secondary,
                onPressed: _pickSms,
              ),
              const SizedBox(height: 12),
              KayaButton(
                label: l10n.authChannelEmail,
                icon: Icons.mail_outline_rounded,
                variant: KayaButtonVariant.secondary,
                onPressed: _pickEmail,
              ),
            ] else if (_channel == _Channel.sms) ...[
              if (_verificationId != null)
                KayaTextField(
                  label: l10n.authCode,
                  controller: _code,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  prefixIcon: Icons.sms_outlined,
                ),
              const SizedBox(height: 20),
              KayaButton(
                label: l10n.authVerify,
                loading: _busy,
                onPressed: _verificationId == null ? null : _verifySms,
              ),
            ] else if (_channel == _Channel.email) ...[
              if (_emailLinkSent)
                Text(l10n.authEmailLinkSent, style: AppTypography.bodySecondary)
              else
                const SizedBox.shrink(),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
          ],
        ),
      ),
    );
  }
}
```

The email branch intentionally stops at "link sent" — completing sign-in from a clicked link arriving via deep link while this screen is gone from the navigation stack is out of scope for this task (spec Risk #3: needs Hosting + a physical device). What's here is real, working code for the part that *can* run today (sending the link); the deep-link-triggered completion handler is future work once Hosting exists, tracked by the spec, not silently dropped.

- [ ] **Step 6: Rewrite `login_screen.dart`, delete `login_otp_screen.dart`**

Delete `apps/client/lib/features/onboarding/login_otp_screen.dart`.

Replace `apps/client/lib/features/onboarding/login_screen.dart` in full:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

/// Payload handed to `/register` when a Google/Facebook sign-in found no
/// existing account. Consumed by the registration wizard (Wave 2b) once it
/// replaces the single-form RegisterScreen this currently routes to.
class SocialSignupExtra {
  const SocialSignupExtra({required this.socialDraftToken, required this.email, this.fullName});
  final String socialDraftToken;
  final String email;
  final String? fullName;
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  final _socialAuth = FirebaseSocialAuthService();
  bool _loading = false;
  bool _socialLoading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final challenge = await ref
          .read(authControllerProvider.notifier)
          .login(_identifier.text.trim(), _password.text);
      if (mounted) {
        context.push('/login-verify', extra: (
          challengeId: challenge.challengeId,
          identifier: _identifier.text.trim(),
        ));
      }
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signInWith(SocialProvider provider) async {
    setState(() {
      _socialLoading = true;
      _error = null;
    });
    try {
      final idToken = await _socialAuth.signIn(provider);
      if (idToken == null) return; // user cancelled
      final outcome = await ref
          .read(authControllerProvider.notifier)
          .socialLogin(idToken, provider.name);
      if (!mounted) return;
      switch (outcome) {
        case SocialLoginSuccess():
          context.go('/home');
        case SocialSignupRequired(:final socialDraftToken, :final email, :final fullName):
          context.push('/register', extra: SocialSignupExtra(
            socialDraftToken: socialDraftToken, email: email, fullName: fullName));
      }
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _socialLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authLogin, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
              label: '${l10n.authEmail} / ${l10n.authPhone}',
              hint: 'kofi@example.com',
              controller: _identifier,
              keyboardType: TextInputType.emailAddress,
              prefixIcon: Icons.person_outline_rounded,
            ),
            const SizedBox(height: 16),
            KayaTextField(
              label: l10n.authPassword,
              controller: _password,
              obscureText: _obscure,
              prefixIcon: Icons.lock_outline_rounded,
              suffixIcon: IconButton(
                icon: Icon(
                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: AppColors.inkTertiary),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.push('/password-reset'),
                child: Text(l10n.authForgotPassword),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: l10n.authLogin,
              loading: _loading,
              onPressed: _submit,
            ),
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authRegister,
              variant: KayaButtonVariant.secondary,
              onPressed: () => context.push('/register'),
            ),
            const SizedBox(height: 24),
            Center(child: Text(l10n.authOrContinueWith, style: AppTypography.caption)),
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authContinueWithGoogle,
              icon: Icons.g_mobiledata_rounded,
              variant: KayaButtonVariant.secondary,
              loading: _socialLoading,
              onPressed: () => _signInWith(SocialProvider.google),
            ),
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authContinueWithFacebook,
              icon: Icons.facebook_outlined,
              variant: KayaButtonVariant.secondary,
              loading: _socialLoading,
              onPressed: () => _signInWith(SocialProvider.facebook),
            ),
          ],
        ),
      ),
    );
  }
}
```

`LoginVerifyScreen` needs the user's phone/email to know who to send the SMS/email code to, but `/auth/login` only returns a `challengeId` (the backend deliberately doesn't leak account details before 2FA — see the Wave 1 spec). Pass the identifier the user typed through as route `extra` alongside the challenge, and have `LoginVerifyScreen`'s constructor accept it as `phone`/`email` — since the user might have typed either a phone or an email as their `identifier`, `LoginVerifyScreen` shows *both* channel buttons regardless (Step 5's UI already does this — it doesn't need to know in advance which one the identifier was), so pass the same typed string as both `phone` and `email` to the record type the router hands it (the router builder in Step 7 destructures `challengeId`/`identifier` and passes `identifier` for both parameters; if the user typed a phone, the SMS button works and the email button will simply fail server-side email-format validation if tapped, which is an acceptable edge case for this wave, not a crash).

- [ ] **Step 7: Update the router**

In `apps/client/lib/router.dart`:

Remove the import `import 'features/onboarding/login_otp_screen.dart';` and the route `GoRoute(path: '/login-otp', builder: (_, __) => const LoginOtpScreen()),`.

Add the import `import 'features/onboarding/login_verify_screen.dart';` and, right after the `/login` route:

```dart
      GoRoute(
        path: '/login-verify',
        builder: (_, state) {
          final extra = state.extra as ({String challengeId, String identifier});
          return LoginVerifyScreen(
            challengeId: extra.challengeId,
            phone: extra.identifier,
            email: extra.identifier,
          );
        },
      ),
```

Add `'/login-verify'` to the `onAuthFlow` boolean's `loc.startsWith(...)` chain (so the redirect logic treats it as part of the pre-auth flow, matching how `/otp` is already handled).

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/client && flutter test test/login_flow_test.dart && flutter analyze`
Expected: all 4 tests pass, analyzer clean (no remaining references to `LoginOtpScreen`/`loginWithOtp` in this app).

- [ ] **Step 9: Commit**

```bash
git add apps/client/lib/providers/auth_provider.dart apps/client/lib/features/onboarding/login_screen.dart apps/client/lib/features/onboarding/login_verify_screen.dart apps/client/lib/router.dart apps/client/test/login_flow_test.dart packages/kaya_core/lib/src/l10n/kaya_l10n.dart
git rm apps/client/lib/features/onboarding/login_otp_screen.dart
git commit -m "feat(client): two-step 2FA login, Google/Facebook sign-in, remove standalone login-by-code"
```

---

### Task 4: Driver app — mirror Task 3

**Files:**
- Modify: `apps/driver/lib/providers/auth_provider.dart`
- Modify: `apps/driver/lib/features/onboarding/login_screen.dart`
- Create: `apps/driver/lib/features/onboarding/login_verify_screen.dart`
- Delete: `apps/driver/lib/features/onboarding/login_otp_screen.dart`
- Modify: `apps/driver/lib/router.dart`
- Modify: `packages/kaya_core/lib/src/l10n/kaya_l10n.dart` (remove the `authLoginOtp` getter now that both apps' callers are gone — see Task 3 Step 4's note)
- Create: `apps/driver/test/login_flow_test.dart`

**Interfaces:**
- Same as Task 3 — identical shapes, this is the driver app's own copy of the same screens/controller (this codebase does not share screens between apps, only `kaya_core`; Tasks 3 and 4 are independent commits a reviewer can approve/reject separately even though the diffs are near-identical, since they touch entirely disjoint files).

- [ ] **Step 1: Write the failing test**

Copy `apps/client/test/login_flow_test.dart` to `apps/driver/test/login_flow_test.dart`, changing only the two `import 'package:kaya_client/...'` lines to this app's package name (check `apps/driver/pubspec.yaml`'s `name:` field — likely `kaya_driver`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/driver && flutter test test/login_flow_test.dart`
Expected: FAIL, same reasons as Task 3 Step 2.

- [ ] **Step 3: Rewrite `AuthController`**

Apply the exact same `login`/`verifyLogin`/`socialLogin` changes as Task 3 Step 3 to `apps/driver/lib/providers/auth_provider.dart`. This file's `AuthState.copyWith` has no `clearUser` parameter (unlike the client's) — leave that difference alone, it's unrelated to this change.

- [ ] **Step 4: Write `LoginVerifyScreen`**

Copy Task 3 Step 5's file to `apps/driver/lib/features/onboarding/login_verify_screen.dart` verbatim, except the email-link config in `_pickEmail`: use `androidPackageName: 'com.kaya.kaya_driver'` and `iosBundleId: 'com.kaya.kayaDriver'` (this app's actual bundle identifiers — verify against `apps/driver/android/app/build.gradle`'s `applicationId` before committing; the decision log at `BLUEPRINT.md` line 110 records these as provisional).

- [ ] **Step 5: Rewrite `login_screen.dart`, delete `login_otp_screen.dart`**

Delete `apps/driver/lib/features/onboarding/login_otp_screen.dart`.

Apply Task 3 Step 6's `login_screen.dart` verbatim (including the `SocialSignupExtra` class — the driver app gets its own copy, same as every other duplicated onboarding screen in this codebase).

- [ ] **Step 6: Update the router**

Apply Task 3 Step 7's router changes to `apps/driver/lib/router.dart`.

- [ ] **Step 7: Remove the now-fully-dead `authLoginOtp` l10n getter**

Run: `grep -rn "authLoginOtp" apps/ packages/` — expect zero matches now that both apps' `LoginOtpScreen` callers are deleted (Task 3 Step 6 + this task's Step 5). Remove the `authLoginOtp` getter and the `// TODO(wave-2a)` line from `packages/kaya_core/lib/src/l10n/kaya_l10n.dart`.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/driver && flutter test test/login_flow_test.dart && flutter analyze && cd ../../packages/kaya_core && flutter analyze`
Expected: driver tests pass, both analyzers clean (the kaya_core check confirms Step 7's getter removal didn't leave a dangling reference anywhere in kaya_core itself).

- [ ] **Step 9: Whole-plan verification**

Run, from the repo root:
```bash
cd packages/kaya_core && flutter test && flutter analyze
cd ../../apps/client && flutter test && flutter analyze
cd ../driver && flutter test && flutter analyze
```
Expected: all green. This is the plan's final gate before the whole-branch review this wave's progress ledger calls for (same pattern as Wave 1's backend review).

- [ ] **Step 10: Commit**

```bash
git add apps/driver/lib/providers/auth_provider.dart apps/driver/lib/features/onboarding/login_screen.dart apps/driver/lib/features/onboarding/login_verify_screen.dart apps/driver/lib/router.dart apps/driver/test/login_flow_test.dart packages/kaya_core/lib/src/l10n/kaya_l10n.dart
git rm apps/driver/lib/features/onboarding/login_otp_screen.dart
git commit -m "feat(driver): two-step 2FA login, Google/Facebook sign-in, remove standalone login-by-code"
```
