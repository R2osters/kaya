import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/providers/auth_provider.dart';
import 'package:kaya_client/providers/core_providers.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  test('login() returns a LoginChallenge without authenticating', () async {
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

  test('verifyLogin() authenticates on a valid challenge', () async {
    final container = ProviderContainer(overrides: [
      kayaApiProvider.overrideWith((ref) => _StubApi()),
      tokenStoreProvider.overrideWith((ref) => InMemoryTokenStore()),
    ]);
    addTearDown(container.dispose);

    final controller = container.read(authControllerProvider.notifier);
    await controller.verifyLogin(challengeId: 'chal-1', firebaseIdToken: 'tok');

    expect(container.read(authControllerProvider).isAuthenticated, isTrue);
  });

  test('socialLogin() authenticates immediately for an existing account', () async {
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

  test('socialLogin() does not authenticate for a brand-new account', () async {
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
      : super(config: const ApiConfig(baseUrl: 'http://test.local'), store: InMemoryTokenStore());
  final bool newAccount;

  // Overriding a concrete field (rather than a getter) is the shape KayaApi
  // exposes `auth` in; this stub intentionally replaces it for the test.
  @override
  // ignore: overridden_fields
  late final AuthApi auth = _StubAuthApi(this, newAccount);
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
