import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'core_providers.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({this.status = AuthStatus.unknown, this.user});

  final AuthStatus status;
  final User? user;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({AuthStatus? status, User? user}) => AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
      );
}

/// Session owner for the driver app. Same lifecycle as the client but registers
/// with the `livreur` role and country-specific document fields.
class AuthController extends StateNotifier<AuthState> {
  AuthController(this._ref) : super(const AuthState()) {
    _bootstrap();
  }

  final Ref _ref;

  KayaApi get _api => _ref.read(kayaApiProvider);
  TokenStore get _store => _ref.read(tokenStoreProvider);
  SocketService get _socket => _ref.read(socketServiceProvider);

  Future<void> _bootstrap() async {
    final token = await _store.readAccess();
    if (token == null || token.isEmpty) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }
    try {
      final user = await _api.auth.me();
      _socket.connect(token);
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> login(String identifier, String password) async {
    final result = await _api.auth.login(identifier, password);
    await _store.save(result.tokens);
    final user = result.user ?? await _api.auth.me();
    _socket.connect(result.tokens.accessToken);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> loginWithOtp(String phone, String firebaseIdToken) async {
    final result = await _api.auth.loginWithOtp(phone: phone, firebaseIdToken: firebaseIdToken);
    await _store.save(result.tokens);
    final user = result.user ?? await _api.auth.me();
    _socket.connect(result.tokens.accessToken);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> register(Map<String, dynamic> body) async {
    final result = await _api.auth.register(body);
    await _store.save(result.tokens);
    final user = result.user ?? await _api.auth.me();
    _socket.connect(result.tokens.accessToken);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> refreshMe() async {
    try {
      final user = await _api.auth.me();
      state = state.copyWith(user: user);
    } catch (_) {}
  }

  /// Persists the online/offline flag on the profile.
  Future<void> setOnline(bool online) async {
    final updated = await _api.auth.updateProfile({'isOnline': online});
    state = state.copyWith(user: updated);
  }

  Future<void> logout() async {
    final refresh = await _store.readRefresh();
    if (refresh != null) {
      try {
        await _api.auth.logout(refresh);
      } catch (_) {}
    }
    await _store.clear();
    _socket.disconnect();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref);
});

final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authControllerProvider).user;
});
