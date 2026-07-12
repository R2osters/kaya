import 'json_utils.dart';
import 'user.dart';

/// Token pair returned by login/register/refresh.
class AuthTokens {
  const AuthTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  factory AuthTokens.fromJson(Map<String, dynamic> j) => AuthTokens(
        accessToken: asString(j['accessToken'] ?? j['access_token']),
        refreshToken: asString(j['refreshToken'] ?? j['refresh_token']),
      );
}

/// Login/register response: tokens plus (optionally) the user profile.
class AuthResult {
  const AuthResult({required this.tokens, this.user});

  final AuthTokens tokens;
  final User? user;

  factory AuthResult.fromJson(Map<String, dynamic> j) => AuthResult(
        tokens: AuthTokens.fromJson(j),
        user: j['user'] is Map ? User.fromJson(asMap(j['user'])) : null,
      );
}
