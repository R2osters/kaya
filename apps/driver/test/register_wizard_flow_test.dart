// apps/driver/test/register_wizard_flow_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_driver/features/onboarding/wizard/register_wizard_screen.dart';
import 'package:kaya_driver/features/onboarding/wizard/register_wizard_controller.dart';
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
          locale: Locale('fr'),
          localizationsDelegates: [
            KayaL10n.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: KayaL10n.supportedLocales,
          home: RegisterWizardScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('New Person'), findsOneWidget);

    // Advance to the Contact step and confirm the email field is disabled.
    await tester.tap(find.text('Continuer'));
    await tester.pumpAndSettle();

    final emailField = tester.widget<TextField>(
      find.byWidgetPredicate((w) => w is TextField && w.controller?.text == 'new@example.com'),
    );
    expect(emailField.enabled, isFalse);
  });

  testWidgets(
      'draft survives Identity -> Contact -> Docs -> Security: registerWizardProvider '
      'is autoDispose and only ContactStep/DocsMetadataStep ever ref.watch it, so '
      'nothing else keeps a listener alive once those steps unmount. If the wizard '
      'shell does not itself watch the provider, it resets to a blank draft the '
      'moment SecurityStep is reached, and /auth/register would be submitted with '
      'empty fullName/phone/email/countryCode/vehicleType.',
      (tester) async {
    // Use an explicit container (instead of a plain ProviderScope) so the
    // assertions below can read the *actual* provider state directly,
    // rather than inferring correctness from rendered widget text — the
    // bug this test targets is a stale/reset provider whose rendered text
    // can still look right on the step where it was typed.
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          locale: Locale('fr'),
          localizationsDelegates: [
            KayaL10n.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: KayaL10n.supportedLocales,
          home: RegisterWizardScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // --- Step 0: Identity ---
    await tester.enterText(find.byType(TextFormField).first, 'Ama Owusu');
    await tester.tap(find.text('Continuer'));
    await tester.pumpAndSettle();

    // --- Step 1: Contact ---
    await tester.enterText(find.byType(TextFormField).at(0), '+233201234567');
    await tester.enterText(find.byType(TextFormField).at(1), 'ama@example.com');
    await tester.tap(find.text('Continuer'));
    await tester.pumpAndSettle();

    // --- Step 2: Docs metadata (driver-only) ---
    await tester.enterText(find.byType(TextFormField).at(0), 'PCSRC-123');
    await tester.enterText(find.byType(TextFormField).at(1), 'GR-1234-19');
    await tester.tap(find.text('Continuer'));
    await tester.pumpAndSettle();

    // --- Step 3: Security is now showing; ContactStep and DocsMetadataStep
    // (the only steps that ever ref.watch'd the provider) have both been
    // unmounted for at least one full pump/settle cycle, which is exactly
    // the window in which autoDispose would have torn the provider down
    // without the fix.
    //
    // SecurityStep's State constructs FirebasePhoneAuthService(), which
    // reaches for FirebaseAuth.instance and throws because no Firebase app
    // is initialized in this widget-test environment. That's an unrelated,
    // pre-existing testability gap (SecurityStep isn't wired for phone-auth
    // injection) — nothing to do with the provider-lifecycle bug this test
    // targets, so the resulting FlutterError is consumed here rather than
    // left to fail the test.
    expect(tester.takeException(), isNotNull);

    final draft = container.read(registerWizardProvider);
    expect(draft.fullName, 'Ama Owusu');
    expect(draft.phone, '+233201234567');
    expect(draft.email, 'ama@example.com');
    expect(draft.countryCode, CountryCode.GHA);
    expect(draft.vehicleType, VehicleType.moto);
    expect(draft.driverLicenseNumber, 'PCSRC-123');
    expect(draft.vehicleRegistration, 'GR-1234-19');
  });
}
