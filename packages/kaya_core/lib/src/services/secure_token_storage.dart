import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/auth_result.dart';

/// Persists the JWT pair in the platform secure enclave / keystore.
///
/// Abstracted so the API interceptor depends on an interface, and tests can
/// swap an in-memory implementation.
abstract interface class TokenStore {
  Future<String?> readAccess();
  Future<String?> readRefresh();
  Future<void> save(AuthTokens tokens);
  Future<void> clear();
}

class SecureTokenStorage implements TokenStore {
  SecureTokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  final FlutterSecureStorage _storage;

  static const _kAccess = 'kaya.access_token';
  static const _kRefresh = 'kaya.refresh_token';

  @override
  Future<String?> readAccess() => _storage.read(key: _kAccess);

  @override
  Future<String?> readRefresh() => _storage.read(key: _kRefresh);

  @override
  Future<void> save(AuthTokens tokens) async {
    await _storage.write(key: _kAccess, value: tokens.accessToken);
    await _storage.write(key: _kRefresh, value: tokens.refreshToken);
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}

/// In-memory token store for tests and previews (no platform channels).
class InMemoryTokenStore implements TokenStore {
  String? _access;
  String? _refresh;

  @override
  Future<String?> readAccess() async => _access;

  @override
  Future<String?> readRefresh() async => _refresh;

  @override
  Future<void> save(AuthTokens tokens) async {
    _access = tokens.accessToken;
    _refresh = tokens.refreshToken;
  }

  @override
  Future<void> clear() async {
    _access = null;
    _refresh = null;
  }
}
