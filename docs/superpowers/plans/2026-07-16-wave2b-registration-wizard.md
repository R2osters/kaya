# Wave 2b — Registration Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace each app's single long registration form with a multi-step wizard (Identité → Contact → Sécurité, plus a Docs-metadata step for the driver app), and make it the landing spot for a Google/Facebook sign-up that found no existing account (`SocialSignupRequired`, from Wave 2a).

**Architecture:** One `RegisterDraft` state class + `RegisterWizardController` (Riverpod `StateNotifier`) per app — this codebase does not share screens or app-level controllers between `apps/client` and `apps/driver` (only `kaya_core` is shared), so the wizard follows that existing pattern rather than introducing a new shared-controller convention. Each step is its own widget; a shared progress bar sits above an `IndexedStack`/manual step switch. The wizard's final step performs Firebase phone verification inline (replacing today's separate push-to-`/otp` hop) and submits once to the unchanged `POST /auth/register`.

**Tech Stack:** Flutter 3.22+, Riverpod (`StateNotifier`), `go_router`, `firebase_auth` (via the existing `PhoneAuthService`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-social-login-2fa-wizard-design.md`. Depends on `docs/superpowers/plans/2026-07-16-wave2a-auth-flows.md` landing first — this plan consumes `SocialSignupExtra` (defined in that plan's Task 3, `apps/client/lib/features/onboarding/login_screen.dart`, and Task 4's driver mirror) as the payload routed to `/register` on a new-account social sign-up.
- The **document photo uploads** (national ID, driver licence, vehicle registration, PCSRC QR) are explicitly **not** part of this wizard. They already happen after registration, on the existing `DocumentVerificationScreen` (`apps/driver/lib/features/onboarding/document_verification_screen.dart`, route `/verify-documents`) — correctly so, since the upload endpoints (`/auth/upload-id`, `/auth/upload-license`) require an authenticated user, which only exists after `POST /auth/register` succeeds. This plan does not touch that screen. The wizard's driver-only "Docs" step (spec step 4) covers only the **text metadata** already present in today's single-form `RegisterScreen` — licence number, vehicle type, vehicle registration — which today are submitted as part of the one `RegisterDto` payload, same as after this change.
- `apps/*/lib/features/onboarding/otp_screen.dart` (the registration-flow OTP screen, distinct from Wave 2a's now-deleted `login_otp_screen.dart`) becomes dead code once the wizard's last step does phone verification inline and submits directly — this plan deletes it and the `/otp` route in both apps, same reasoning Wave 2a applied to `login_otp_screen.dart`.
- `RegisterScreen` (today's single-form screen, both apps) is replaced outright, not kept as an alternate path.
- Code + comments in English. UI strings via `KayaL10n`. Money-path/backend code is untouched — this is Flutter-only.
- Every task leaves `flutter analyze` and `flutter test` clean in whichever package/app it touches.

---

### Task 1: Client — `RegisterDraft` + `RegisterWizardController`

**Files:**
- Create: `apps/client/lib/features/onboarding/wizard/register_draft.dart`
- Create: `apps/client/lib/features/onboarding/wizard/register_wizard_controller.dart`
- Create: `apps/client/test/register_wizard_controller_test.dart`

**Interfaces:**
- Produces: `RegisterDraft` (immutable state: `fullName`, `role` fixed to `'client'`, `countryCode`, `phone`, `email`, `password`, `socialDraftToken`, `emailLocked`) with `copyWith` and `toRegisterBody(String firebaseIdToken) -> Map<String, dynamic>`. Task 2 depends on this exact shape.
- Produces: `RegisterWizardController` with `updateIdentity`, `updateContact`, `updatePassword`, `prefillFromSocial`, and `registerWizardProvider` (`StateNotifierProvider.autoDispose`). Task 2 depends on these method names.

- [ ] **Step 1: Write the failing test**

```dart
// apps/client/test/register_wizard_controller_test.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/features/onboarding/wizard/register_draft.dart';
import 'package:kaya_client/features/onboarding/wizard/register_wizard_controller.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  test('starts with the client role fixed and nothing else set', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final draft = container.read(registerWizardProvider);
    expect(draft.role, 'client');
    expect(draft.fullName, '');
    expect(draft.socialDraftToken, isNull);
  });

  test('updateIdentity / updateContact / updatePassword accumulate into one draft', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final controller = container.read(registerWizardProvider.notifier);

    controller.updateIdentity(fullName: 'Kofi Mensah', country: CountryCode.GHA);
    controller.updateContact(phone: '+233201234567', email: 'kofi@example.com');
    controller.updatePassword('SecurePass123!');

    final draft = container.read(registerWizardProvider);
    expect(draft.fullName, 'Kofi Mensah');
    expect(draft.countryCode, CountryCode.GHA);
    expect(draft.phone, '+233201234567');
    expect(draft.email, 'kofi@example.com');
    expect(draft.password, 'SecurePass123!');
  });

  test('prefillFromSocial locks the email and sets the draft token, no password', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final controller = container.read(registerWizardProvider.notifier);

    controller.prefillFromSocial(
      email: 'new@example.com', fullName: 'New Person', socialDraftToken: 'draft-tok');

    final draft = container.read(registerWizardProvider);
    expect(draft.email, 'new@example.com');
    expect(draft.fullName, 'New Person');
    expect(draft.socialDraftToken, 'draft-tok');
    expect(draft.emailLocked, isTrue);
  });

  test('toRegisterBody uses password when there is no social draft token', () {
    const draft = RegisterDraft(
      role: 'client',
      fullName: 'Kofi Mensah',
      countryCode: CountryCode.GHA,
      phone: '+233201234567',
      email: 'kofi@example.com',
      password: 'SecurePass123!',
    );
    final body = draft.toRegisterBody('phone-proof-token');
    expect(body['password'], 'SecurePass123!');
    expect(body.containsKey('socialDraftToken'), isFalse);
    expect(body['firebaseIdToken'], 'phone-proof-token');
    expect(body['role'], 'client');
    expect(body['countryCode'], 'GHA');
  });

  test('toRegisterBody uses socialDraftToken instead of password when present', () {
    const draft = RegisterDraft(
      role: 'client',
      fullName: 'New Person',
      countryCode: CountryCode.GHA,
      phone: '+233209999999',
      email: 'new@example.com',
      socialDraftToken: 'draft-tok',
      emailLocked: true,
    );
    final body = draft.toRegisterBody('phone-proof-token');
    expect(body['socialDraftToken'], 'draft-tok');
    expect(body.containsKey('password'), isFalse);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/client && flutter test test/register_wizard_controller_test.dart`
Expected: FAIL — the two new files don't exist yet.

- [ ] **Step 3: Write `RegisterDraft`**

```dart
// apps/client/lib/features/onboarding/wizard/register_draft.dart
import 'package:kaya_core/kaya_core.dart';

/// Accumulates the registration form across wizard steps. Mirrors the fields
/// today's single-form RegisterScreen already sends to POST /auth/register —
/// the wizard restructures the UI, not the payload shape.
class RegisterDraft {
  const RegisterDraft({
    required this.role,
    this.fullName = '',
    this.countryCode = CountryCode.GHA,
    this.phone = '',
    this.email = '',
    this.password = '',
    this.socialDraftToken,
    this.emailLocked = false,
  });

  final String role;
  final String fullName;
  final CountryCode countryCode;
  final String phone;
  final String email;
  final String password;
  final String? socialDraftToken;
  final bool emailLocked;

  RegisterDraft copyWith({
    String? fullName,
    CountryCode? countryCode,
    String? phone,
    String? email,
    String? password,
    String? socialDraftToken,
    bool? emailLocked,
  }) =>
      RegisterDraft(
        role: role,
        fullName: fullName ?? this.fullName,
        countryCode: countryCode ?? this.countryCode,
        phone: phone ?? this.phone,
        email: email ?? this.email,
        password: password ?? this.password,
        socialDraftToken: socialDraftToken ?? this.socialDraftToken,
        emailLocked: emailLocked ?? this.emailLocked,
      );

  Map<String, dynamic> toRegisterBody(String firebaseIdToken) => {
        'fullName': fullName,
        'email': email,
        'phone': phone,
        'role': role,
        'countryCode': countryCode.wire,
        'firebaseIdToken': firebaseIdToken,
        if (socialDraftToken != null) 'socialDraftToken': socialDraftToken else 'password': password,
      };
}
```

- [ ] **Step 4: Write `RegisterWizardController`**

```dart
// apps/client/lib/features/onboarding/wizard/register_wizard_controller.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'register_draft.dart';

class RegisterWizardController extends StateNotifier<RegisterDraft> {
  RegisterWizardController() : super(const RegisterDraft(role: 'client'));

  void updateIdentity({required String fullName, required CountryCode country}) =>
      state = state.copyWith(fullName: fullName, countryCode: country);

  void updateContact({required String phone, required String email}) =>
      state = state.copyWith(phone: phone, email: email);

  void updatePassword(String password) => state = state.copyWith(password: password);

  void prefillFromSocial({
    required String email,
    String? fullName,
    required String socialDraftToken,
  }) =>
      state = state.copyWith(
        email: email,
        fullName: fullName ?? state.fullName,
        socialDraftToken: socialDraftToken,
        emailLocked: true,
      );
}

final registerWizardProvider =
    StateNotifierProvider.autoDispose<RegisterWizardController, RegisterDraft>((ref) {
  return RegisterWizardController();
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/client && flutter test test/register_wizard_controller_test.dart && flutter analyze`
Expected: all 5 tests pass, clean.

- [ ] **Step 6: Commit**

```bash
git add apps/client/lib/features/onboarding/wizard/register_draft.dart apps/client/lib/features/onboarding/wizard/register_wizard_controller.dart apps/client/test/register_wizard_controller_test.dart
git commit -m "feat(client): add RegisterDraft state and RegisterWizardController for the registration wizard"
```

---

### Task 2: Client — wizard step screens, router wiring, delete the old form + OTP hop

**Files:**
- Create: `apps/client/lib/features/onboarding/wizard/register_wizard_screen.dart` (shell: progress bar + step switch)
- Create: `apps/client/lib/features/onboarding/wizard/identity_step.dart`
- Create: `apps/client/lib/features/onboarding/wizard/contact_step.dart`
- Create: `apps/client/lib/features/onboarding/wizard/security_step.dart`
- Delete: `apps/client/lib/features/onboarding/register_screen.dart`
- Delete: `apps/client/lib/features/onboarding/otp_screen.dart`
- Modify: `apps/client/lib/router.dart`
- Modify: `apps/client/lib/features/onboarding/login_screen.dart` (the `/register` push already carries `SocialSignupExtra` from Wave 2a — no change needed there, but this task is what makes that `extra` actually get read, at the router)
- Create: `apps/client/test/register_wizard_flow_test.dart`

**Interfaces:**
- Consumes: `RegisterDraft`/`RegisterWizardController`/`registerWizardProvider` (Task 1); `SocialSignupExtra` (Wave 2a, `login_screen.dart`); `AuthController.register(Map)` (unchanged, already exists).

- [ ] **Step 1: Write the failing test**

```dart
// apps/client/test/register_wizard_flow_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/features/onboarding/wizard/register_wizard_screen.dart';
import 'package:kaya_client/features/onboarding/wizard/register_wizard_controller.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets('a social sign-up prefill locks the email field', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          registerWizardProvider.overrideWith((ref) {
            final c = RegisterWizardController();
            c.prefillFromSocial(email: 'new@example.com', fullName: 'New Person', socialDraftToken: 'draft');
            return c;
          }),
        ],
        child: const MaterialApp(
          localizationsDelegates: [KayaL10n.delegate],
          supportedLocales: KayaL10n.supportedLocales,
          home: RegisterWizardScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('New Person'), findsOneWidget);

    // Advance to the Contact step and confirm the email field is disabled.
    await tester.tap(find.byType(ElevatedButton).first.hitTestable().evaluate().isEmpty
        ? find.text('Continuer')
        : find.text('Continuer'));
    await tester.pumpAndSettle();

    final emailField = tester.widget<TextField>(
      find.byWidgetPredicate((w) => w is TextField && w.controller?.text == 'new@example.com'),
    );
    expect(emailField.enabled, isFalse);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/client && flutter test test/register_wizard_flow_test.dart`
Expected: FAIL — `RegisterWizardScreen` doesn't exist yet.

- [ ] **Step 3: Write the step widgets**

```dart
// apps/client/lib/features/onboarding/wizard/identity_step.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'register_wizard_controller.dart';

class IdentityStep extends ConsumerStatefulWidget {
  const IdentityStep({super.key, required this.onNext});
  final VoidCallback onNext;

  @override
  ConsumerState<IdentityStep> createState() => _IdentityStepState();
}

class _IdentityStepState extends ConsumerState<IdentityStep> {
  late final _name = TextEditingController(text: ref.read(registerWizardProvider).fullName);
  CountryCode _country = CountryCode.GHA;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        KayaTextField(
          label: l10n.authFullName,
          controller: _name,
          prefixIcon: Icons.person_outline_rounded,
        ),
        const SizedBox(height: 16),
        Text(l10n.authCountry, style: AppTypography.bodyStrong),
        const SizedBox(height: 8),
        CountryPicker(value: _country, onChanged: (c) => setState(() => _country = c)),
        const SizedBox(height: 28),
        KayaButton(
          label: l10n.actionContinue,
          onPressed: () {
            ref.read(registerWizardProvider.notifier).updateIdentity(
              fullName: _name.text.trim(), country: _country);
            widget.onNext();
          },
        ),
      ],
    );
  }
}

/// Extracted from the old RegisterScreen's private `_CountryPicker` (was
/// duplicated per-app already; now shared by all wizard steps that need it).
class CountryPicker extends StatelessWidget {
  const CountryPicker({super.key, required this.value, required this.onChanged});
  final CountryCode value;
  final ValueChanged<CountryCode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: CountryCode.values.map((c) {
        final active = c == value;
        return Expanded(
          child: GestureDetector(
            onTap: () => onChanged(c),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: active ? AppColors.primaryTint : AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.field),
                border: Border.all(color: active ? AppColors.primary : AppColors.border),
              ),
              child: Column(
                children: [
                  Text(c.flag, style: const TextStyle(fontSize: 20)),
                  const SizedBox(height: 4),
                  Text(c.displayName,
                      style: AppTypography.caption.copyWith(
                        color: active ? AppColors.primary : AppColors.inkSecondary,
                        fontWeight: FontWeight.w700,
                      )),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
```

```dart
// apps/client/lib/features/onboarding/wizard/contact_step.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'register_wizard_controller.dart';

class ContactStep extends ConsumerStatefulWidget {
  const ContactStep({super.key, required this.onNext});
  final VoidCallback onNext;

  @override
  ConsumerState<ContactStep> createState() => _ContactStepState();
}

class _ContactStepState extends ConsumerState<ContactStep> {
  late final _phone = TextEditingController(text: ref.read(registerWizardProvider).phone);
  late final _email = TextEditingController(text: ref.read(registerWizardProvider).email);

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final locked = ref.watch(registerWizardProvider.select((d) => d.emailLocked));
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        KayaTextField(
          label: l10n.authPhone,
          hint: '+233201234567',
          controller: _phone,
          keyboardType: TextInputType.phone,
          prefixIcon: Icons.phone_outlined,
        ),
        const SizedBox(height: 16),
        KayaTextField(
          label: l10n.authEmail,
          controller: _email,
          enabled: !locked,
          keyboardType: TextInputType.emailAddress,
          prefixIcon: Icons.mail_outline_rounded,
        ),
        const SizedBox(height: 28),
        KayaButton(
          label: l10n.actionContinue,
          onPressed: () {
            ref.read(registerWizardProvider.notifier).updateContact(
              phone: _phone.text.trim(), email: _email.text.trim());
            widget.onNext();
          },
        ),
      ],
    );
  }
}
```

```dart
// apps/client/lib/features/onboarding/wizard/security_step.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../../providers/auth_provider.dart';
import 'register_wizard_controller.dart';

/// Last step: password (skipped for a social sign-up) + inline phone
/// verification, then the single POST /auth/register submit.
class SecurityStep extends ConsumerStatefulWidget {
  const SecurityStep({super.key});

  @override
  ConsumerState<SecurityStep> createState() => _SecurityStepState();
}

class _SecurityStepState extends ConsumerState<SecurityStep> {
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = false;
  bool _loading = false;
  String? _error;

  bool get _isSocial => ref.read(registerWizardProvider).socialDraftToken != null;

  @override
  void dispose() {
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final phone = ref.read(registerWizardProvider).phone;
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: phone,
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _sending = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _sending = false;
      }),
    );
  }

  Future<void> _confirmAndSubmit() async {
    if (_verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      if (!_isSocial) {
        ref.read(registerWizardProvider.notifier).updatePassword(_password.text);
      }
      final draft = ref.read(registerWizardProvider);
      await ref.read(authControllerProvider.notifier).register(draft.toRegisterBody(idToken));
      if (mounted) context.go('/home');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        if (!_isSocial) ...[
          KayaTextField(
            label: l10n.authPassword,
            controller: _password,
            obscureText: true,
            prefixIcon: Icons.lock_outline_rounded,
          ),
          const SizedBox(height: 16),
        ],
        if (_verificationId == null)
          KayaButton(
            label: l10n.authSendCode,
            loading: _sending,
            onPressed: _sending ? null : _sendCode,
          )
        else
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
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.danger)),
        ],
        const SizedBox(height: 28),
        if (_verificationId != null)
          KayaButton(
            label: l10n.actionConfirm,
            loading: _loading,
            onPressed: _confirmAndSubmit,
          ),
      ],
    );
  }
}
```

- [ ] **Step 4: Write the wizard shell**

```dart
// apps/client/lib/features/onboarding/wizard/register_wizard_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../login_screen.dart' show SocialSignupExtra;
import 'contact_step.dart';
import 'identity_step.dart';
import 'register_wizard_controller.dart';
import 'security_step.dart';

class RegisterWizardScreen extends ConsumerStatefulWidget {
  const RegisterWizardScreen({super.key, this.socialExtra});
  final SocialSignupExtra? socialExtra;

  @override
  ConsumerState<RegisterWizardScreen> createState() => _RegisterWizardScreenState();
}

class _RegisterWizardScreenState extends ConsumerState<RegisterWizardScreen> {
  int _step = 0;
  static const _totalSteps = 3;

  @override
  void initState() {
    super.initState();
    final extra = widget.socialExtra;
    if (extra != null) {
      // Social sign-ups skip straight to Contact (Identity's only field
      // beyond name — which is prefilled here too — is country, still asked).
      Future.microtask(() {
        ref.read(registerWizardProvider.notifier).prefillFromSocial(
          email: extra.email, fullName: extra.fullName, socialDraftToken: extra.socialDraftToken);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.authRegister)),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: LinearProgressIndicator(value: (_step + 1) / _totalSteps),
            ),
            Expanded(
              child: switch (_step) {
                0 => IdentityStep(onNext: () => setState(() => _step = 1)),
                1 => ContactStep(onNext: () => setState(() => _step = 2)),
                _ => const SecurityStep(),
              },
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 5: Delete the old form and OTP hop, update the router**

Delete `apps/client/lib/features/onboarding/register_screen.dart` and `apps/client/lib/features/onboarding/otp_screen.dart`.

In `apps/client/lib/router.dart`: remove the `register_screen.dart` and `otp_screen.dart` imports and the `/otp` route; add `import 'features/onboarding/wizard/register_wizard_screen.dart';` and replace the `/register` route:

```dart
      GoRoute(
        path: '/register',
        builder: (_, state) => RegisterWizardScreen(socialExtra: state.extra as SocialSignupExtra?),
      ),
```

Remove `'/otp'` from the `onAuthFlow` `loc.startsWith(...)` chain (the route no longer exists); `'/register'` is already in that chain and now covers the whole wizard since it's all one route.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/client && flutter test test/register_wizard_flow_test.dart test/register_wizard_controller_test.dart && flutter analyze`
Expected: both test files pass, analyzer clean (no remaining references to the deleted `RegisterScreen`/`OtpScreen`/`OtpArgs`).

- [ ] **Step 7: Commit**

```bash
git add apps/client/lib/features/onboarding/wizard apps/client/lib/router.dart apps/client/test/register_wizard_flow_test.dart
git rm apps/client/lib/features/onboarding/register_screen.dart apps/client/lib/features/onboarding/otp_screen.dart
git commit -m "feat(client): replace the single-form register screen with a 3-step wizard"
```

---

### Task 3: Driver — mirror Task 1+2, plus the Docs-metadata step

**Files:**
- Create: `apps/driver/lib/features/onboarding/wizard/register_draft.dart`
- Create: `apps/driver/lib/features/onboarding/wizard/register_wizard_controller.dart`
- Create: `apps/driver/lib/features/onboarding/wizard/register_wizard_screen.dart`
- Create: `apps/driver/lib/features/onboarding/wizard/identity_step.dart`
- Create: `apps/driver/lib/features/onboarding/wizard/contact_step.dart`
- Create: `apps/driver/lib/features/onboarding/wizard/security_step.dart`
- Create: `apps/driver/lib/features/onboarding/wizard/docs_metadata_step.dart` (driver-only 4th step)
- Delete: `apps/driver/lib/features/onboarding/register_screen.dart`
- Delete: `apps/driver/lib/features/onboarding/otp_screen.dart`
- Modify: `apps/driver/lib/router.dart`
- Create: `apps/driver/test/register_wizard_controller_test.dart`
- Create: `apps/driver/test/register_wizard_flow_test.dart`

**Interfaces:**
- `RegisterDraft` gains three driver-only fields: `vehicleType` (`VehicleType?`), `driverLicenseNumber` (`String?`), `vehicleRegistration` (`String?`) — added to `toRegisterBody`'s output when non-null, matching today's driver `RegisterScreen`'s payload exactly.
- Everything else mirrors Task 1+2 (see those tasks' full code — this task applies the identical pattern with `role: 'livreur'` fixed instead of `'client'`, and one extra step).

- [ ] **Step 1: Write the failing tests**

Copy `apps/client/test/register_wizard_controller_test.dart` and `apps/client/test/register_wizard_flow_test.dart` to `apps/driver/test/`, updating package imports to `kaya_driver` (check `apps/driver/pubspec.yaml`) and adding two more cases to the controller test file:

```dart
  test('updateDriverDocs sets vehicle/license fields', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final controller = container.read(registerWizardProvider.notifier);

    controller.updateDriverDocs(
      vehicleType: VehicleType.moto, driverLicenseNumber: 'PCSRC-123', vehicleRegistration: 'GR-1234-19');

    final draft = container.read(registerWizardProvider);
    expect(draft.vehicleType, VehicleType.moto);
    expect(draft.driverLicenseNumber, 'PCSRC-123');
    expect(draft.vehicleRegistration, 'GR-1234-19');
  });

  test('toRegisterBody includes driver metadata only when set', () {
    const draft = RegisterDraft(
      role: 'livreur',
      fullName: 'Kofi',
      countryCode: CountryCode.GHA,
      phone: '+233201234567',
      email: 'kofi@example.com',
      password: 'SecurePass123!',
      vehicleType: VehicleType.moto,
      driverLicenseNumber: 'PCSRC-123',
    );
    final body = draft.toRegisterBody('tok');
    expect(body['vehicleType'], 'moto');
    expect(body['driverLicenseNumber'], 'PCSRC-123');
    expect(body.containsKey('vehicleRegistration'), isFalse);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/driver && flutter test test/register_wizard_controller_test.dart test/register_wizard_flow_test.dart`
Expected: FAIL — none of the driver wizard files exist yet.

- [ ] **Step 3: Write `RegisterDraft` and `RegisterWizardController` (driver)**

Apply Task 1 Step 3's `RegisterDraft`, with `role` fixed to `'livreur'` at the controller's initial state and three added fields:

```dart
  final VehicleType? vehicleType;
  final String? driverLicenseNumber;
  final String? vehicleRegistration;
```

added to the constructor, `copyWith`, and `toRegisterBody`:

```dart
        if (vehicleType != null) 'vehicleType': vehicleType!.name,
        if (driverLicenseNumber != null) 'driverLicenseNumber': driverLicenseNumber,
        if (vehicleRegistration != null) 'vehicleRegistration': vehicleRegistration,
```

Apply Task 1 Step 4's controller with `super(const RegisterDraft(role: 'livreur'))` and one added method:

```dart
  void updateDriverDocs({VehicleType? vehicleType, String? driverLicenseNumber, String? vehicleRegistration}) =>
      state = state.copyWith(
        vehicleType: vehicleType,
        driverLicenseNumber: driverLicenseNumber,
        vehicleRegistration: vehicleRegistration,
      );
```

(`copyWith` needs the three new parameters added the same way as the existing ones — nullable passthrough via `??`.)

- [ ] **Step 4: Write the four step widgets**

Apply Task 2 Step 3's `identity_step.dart`, `contact_step.dart`, `security_step.dart` verbatim (only the relative import path to `auth_provider.dart` changes, same as every other duplicated onboarding file between the two apps). Add the driver-only fourth step:

```dart
// apps/driver/lib/features/onboarding/wizard/docs_metadata_step.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'register_wizard_controller.dart';

class DocsMetadataStep extends ConsumerStatefulWidget {
  const DocsMetadataStep({super.key, required this.onNext});
  final VoidCallback onNext;

  @override
  ConsumerState<DocsMetadataStep> createState() => _DocsMetadataStepState();
}

class _DocsMetadataStepState extends ConsumerState<DocsMetadataStep> {
  final _license = TextEditingController();
  final _vehicleReg = TextEditingController();
  VehicleType _vehicle = VehicleType.moto;

  @override
  void dispose() {
    _license.dispose();
    _vehicleReg.dispose();
    super.dispose();
  }

  String _licenseLabel(KayaL10n l10n, CountryCode country) => switch (country) {
        CountryCode.GHA => l10n.driverLicensePcsrc,
        CountryCode.TGO => l10n.driverCardPro,
        CountryCode.BEN => l10n.driverCourierPermit,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final country = ref.watch(registerWizardProvider.select((d) => d.countryCode));
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(l10n.driverVehicle, style: AppTypography.bodyStrong),
        const SizedBox(height: 8),
        Row(
          children: VehicleType.values.map((v) {
            final active = v == _vehicle;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(v.name),
                selected: active,
                onSelected: (_) => setState(() => _vehicle = v),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        KayaTextField(
          label: _licenseLabel(l10n, country),
          controller: _license,
          prefixIcon: Icons.badge_outlined,
        ),
        const SizedBox(height: 16),
        KayaTextField(
          label: l10n.driverVehicleRegistration,
          hint: 'GR-1234-19',
          controller: _vehicleReg,
          prefixIcon: Icons.directions_car_outlined,
        ),
        const SizedBox(height: 28),
        KayaButton(
          label: l10n.actionContinue,
          onPressed: () {
            ref.read(registerWizardProvider.notifier).updateDriverDocs(
              vehicleType: _vehicle,
              driverLicenseNumber: _license.text.trim().isEmpty ? null : _license.text.trim(),
              vehicleRegistration: _vehicleReg.text.trim().isEmpty ? null : _vehicleReg.text.trim(),
            );
            widget.onNext();
          },
        ),
      ],
    );
  }
}
```

- [ ] **Step 5: Write the wizard shell (4 steps) and register it as `/verify-documents`'s predecessor**

Apply Task 2 Step 4's shell with `_totalSteps = 4` and a fourth branch:

```dart
              child: switch (_step) {
                0 => IdentityStep(onNext: () => setState(() => _step = 1)),
                1 => ContactStep(onNext: () => setState(() => _step = 2)),
                2 => DocsMetadataStep(onNext: () => setState(() => _step = 3)),
                _ => const SecurityStep(),
              },
```

`SecurityStep`'s `_confirmAndSubmit` (copied from Task 2) already calls `context.go('/home')` on success for the client app — for the driver app, change that one line to `context.go('/verify-documents')`, matching today's driver `otp_screen.dart` behavior exactly (Global Constraints — the post-registration document upload flow is unchanged).

- [ ] **Step 6: Delete the old form and OTP hop, update the router**

Delete `apps/driver/lib/features/onboarding/register_screen.dart` and `apps/driver/lib/features/onboarding/otp_screen.dart`. Apply Task 2 Step 5's router changes to `apps/driver/lib/router.dart` (the `/verify-documents` route and its `document_verification_screen.dart` import are untouched — nothing in this task modifies that file or route).

- [ ] **Step 7: Run test to verify it passes, then whole-plan verification**

Run: `cd apps/driver && flutter test && flutter analyze`
Expected: all driver tests pass (including the two new driver-only cases from Step 1), clean.

Then, from the repo root:
```bash
cd apps/client && flutter test && flutter analyze
cd ../driver && flutter test && flutter analyze
cd ../../packages/kaya_core && flutter test && flutter analyze
```
Expected: all green — this closes out Wave 2b.

- [ ] **Step 8: Commit**

```bash
git add apps/driver/lib/features/onboarding/wizard apps/driver/lib/router.dart apps/driver/test/register_wizard_controller_test.dart apps/driver/test/register_wizard_flow_test.dart
git rm apps/driver/lib/features/onboarding/register_screen.dart apps/driver/lib/features/onboarding/otp_screen.dart
git commit -m "feat(driver): replace the single-form register screen with a 4-step wizard (adds Docs metadata)"
```
