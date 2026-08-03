import 'dart:async';
import 'package:dio/dio.dart';
import '../models/auth_result.dart';
import '../services/secure_token_storage.dart';

/// Attaches the access token, and transparently rotates the refresh token on a
/// 401 before replaying the original request exactly once.
///
/// Refresh calls are single-flighted: concurrent 401s share one refresh future
/// so we never rotate the token twice in parallel (which would revoke it).
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required this.store,
    required this.refreshClient,
    required this.onSessionExpired,
  });

  final TokenStore store;

  /// A *bare* Dio (no AuthInterceptor) pointed at the REST base URL, used only
  /// to call POST /auth/refresh so we don't recurse.
  final Dio refreshClient;

  /// Invoked once when refresh fails — the app should route back to login.
  final Future<void> Function() onSessionExpired;

  Future<AuthTokens?>? _inFlightRefresh;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra['skipAuth'] != true) {
      final token = await store.readAccess();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final isAuthError = response?.statusCode == 401;
    final alreadyRetried = err.requestOptions.extra['retried'] == true;
    final skipAuth = err.requestOptions.extra['skipAuth'] == true;

    if (!isAuthError || alreadyRetried || skipAuth) {
      return handler.next(err);
    }

    final tokens = await _refreshTokens();
    if (tokens == null) {
      await onSessionExpired();
      return handler.next(err);
    }

    // Replay the original request with the new access token, once.
    try {
      final opts = err.requestOptions
        ..headers['Authorization'] = 'Bearer ${tokens.accessToken}'
        ..extra['retried'] = true;
      final clone = await refreshClient.fetch<dynamic>(opts);
      return handler.resolve(clone);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }

  Future<AuthTokens?> _refreshTokens() {
    // Coalesce concurrent refreshes into one network call.
    return _inFlightRefresh ??= _doRefresh().whenComplete(() {
      _inFlightRefresh = null;
    });
  }

  Future<AuthTokens?> _doRefresh() async {
    final refresh = await store.readRefresh();
    if (refresh == null || refresh.isEmpty) return null;
    try {
      final res = await refreshClient.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': refresh},
        options: Options(extra: {'skipAuth': true, 'retried': true}),
      );
      final tokens = AuthTokens.fromJson(Map<String, dynamic>.from(res.data));
      await store.save(tokens);
      return tokens;
    } on DioException {
      await store.clear();
      return null;
    }
  }
}
