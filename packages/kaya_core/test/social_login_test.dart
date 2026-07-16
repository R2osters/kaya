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
  const config = ApiConfig(baseUrl: 'http://test.local');
  final api = KayaApi(config: config, store: InMemoryTokenStore());
  api.raw.httpClientAdapter = _FakeAdapter(handler);
  return api;
}

void main() {
  group('AuthApi.login', () {
    test('returns a LoginChallenge, not tokens', () async {
      final api = _apiWith((options) {
        expect(options.path, '/auth/login');
        return _json({'challengeId': 'chal-123'}, 200);
      });
      final result = await api.auth.login('kofi@example.com', 'SecurePass123!');
      expect(result.challengeId, 'chal-123');
    });
  });

  group('AuthApi.verifyLoginChallenge', () {
    test('returns full AuthResult on success', () async {
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
    test('maps an existing-account response to SocialLoginSuccess', () async {
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

    test('maps a new-account response to SocialSignupRequired', () async {
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
