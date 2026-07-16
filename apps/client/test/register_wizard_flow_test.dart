// apps/client/test/register_wizard_flow_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
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
}
