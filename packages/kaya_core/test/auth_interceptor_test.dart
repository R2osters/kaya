import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_core/kaya_core.dart';
import 'package:kaya_core/src/api/auth_interceptor.dart';

/// Programmable in-memory HttpClientAdapter. Scripts responses by path so we can
/// simulate: protected call 401 -> /auth/refresh 200 -> replay 200.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final ResponseBody Function(RequestOptions options) handler;
  final List<String> calls = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls.add('${options.method} ${options.path}');
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Map<String, dynamic> body, int status) {
  return ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

void main() {
  test('rotates the refresh token on 401 and replays the request once',
      () async {
    final store = InMemoryTokenStore();
    await store.save(
      const AuthTokens(accessToken: 'old-access', refreshToken: 'r1'),
    );

    var refreshCount = 0;

    ResponseBody handler(RequestOptions options) {
      if (options.path == '/auth/refresh') {
        refreshCount++;
        return _json(
          {'accessToken': 'new-access', 'refreshToken': 'r2'},
          200,
        );
      }
      // Protected resource: 200 only with the rotated access token.
      final auth = options.headers['Authorization'];
      if (auth == 'Bearer new-access') {
        return _json({'ok': true}, 200);
      }
      return _json({'message': 'Unauthorized'}, 401);
    }

    final adapter = _FakeAdapter(handler);
    final options = BaseOptions(baseUrl: 'http://test.local/api/v1');

    final dio = Dio(options)..httpClientAdapter = adapter;
    final refreshDio = Dio(options)..httpClientAdapter = adapter;

    var sessionExpired = false;
    dio.interceptors.add(AuthInterceptor(
      store: store,
      refreshClient: refreshDio,
      onSessionExpired: () async => sessionExpired = true,
    ));

    final res = await dio.get<dynamic>('/auth/me');

    expect(res.statusCode, 200);
    expect(res.data['ok'], true);
    expect(refreshCount, 1, reason: 'refresh should happen exactly once');
    expect(sessionExpired, isFalse);

    // Store now holds the rotated pair.
    expect(await store.readAccess(), 'new-access');
    expect(await store.readRefresh(), 'r2');
  });

  test('signals session expiry when the refresh token is also rejected',
      () async {
    final store = InMemoryTokenStore();
    await store.save(
      const AuthTokens(accessToken: 'old', refreshToken: 'dead'),
    );

    ResponseBody handler(RequestOptions options) {
      if (options.path == '/auth/refresh') {
        return _json({'message': 'Invalid refresh token'}, 401);
      }
      return _json({'message': 'Unauthorized'}, 401);
    }

    final adapter = _FakeAdapter(handler);
    final options = BaseOptions(baseUrl: 'http://test.local/api/v1');
    final dio = Dio(options)..httpClientAdapter = adapter;
    final refreshDio = Dio(options)..httpClientAdapter = adapter;

    var sessionExpired = false;
    dio.interceptors.add(AuthInterceptor(
      store: store,
      refreshClient: refreshDio,
      onSessionExpired: () async => sessionExpired = true,
    ));

    await expectLater(
      dio.get<dynamic>('/auth/me'),
      throwsA(isA<DioException>()),
    );
    expect(sessionExpired, isTrue);
    // Tokens cleared after a failed rotation.
    expect(await store.readAccess(), isNull);
  });
}
