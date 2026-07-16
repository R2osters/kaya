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
