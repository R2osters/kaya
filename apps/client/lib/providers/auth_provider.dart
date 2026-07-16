import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'core_providers.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({this.status = AuthStatus.unknown, this.user});

  final AuthStatus status;
  final User? user;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({AuthStatus? status, User? user, bool clearUser = false}) =>
      AuthState(
        status: status ?? this.status,
        user: clearUser ? null : (user ?? this.user),
      );
}

/// Owns the session: bootstraps tokens on launch, logs in/registers, connects
/// the socket, and clears everything on logout.
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
      _connectSocket(token);
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<LoginChallenge> login(String identifier, String password) async {
    return _api.auth.login(identifier, password);
  }

  Future<void> verifyLogin({required String challengeId, required String firebaseIdToken}) async {
    final result = await _api.auth.verifyLoginChallenge(
      challengeId: challengeId,
      firebaseIdToken: firebaseIdToken,
    );
    await _store.save(result.tokens);
    final user = result.user ?? await _api.auth.me();
    _connectSocket(result.tokens.accessToken);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<SocialLoginOutcome> socialLogin(String firebaseIdToken, String provider) async {
    final outcome = await _api.auth.socialLogin(firebaseIdToken: firebaseIdToken, provider: provider);
    if (outcome is SocialLoginSuccess) {
      final result = outcome.result;
      await _store.save(result.tokens);
      final user = result.user ?? await _api.auth.me();
      _connectSocket(result.tokens.accessToken);
      state = AuthState(status: AuthStatus.authenticated, user: user);
    }
    return outcome;
  }

  Future<void> register(Map<String, dynamic> body) async {
    final result = await _api.auth.register(body);
    await _store.save(result.tokens);
    final user = result.user ?? await _api.auth.me();
    _connectSocket(result.tokens.accessToken);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> refreshMe() async {
    try {
      final user = await _api.auth.me();
      state = state.copyWith(user: user);
    } catch (_) {/* keep last known */}
  }

  Future<void> logout() async {
    final refresh = await _store.readRefresh();
    if (refresh != null) {
      try {
        await _api.auth.logout(refresh);
      } catch (_) {/* best effort */}
    }
    await _store.clear();
    _socket.disconnect();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  void _connectSocket(String accessToken) => _socket.connect(accessToken);
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref);
});

/// The current signed-in user (null until authenticated).
final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authControllerProvider).user;
});
