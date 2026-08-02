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

/// Response to `POST /auth/login`: a redeemable 2FA challenge, not tokens.
class LoginChallenge {
  const LoginChallenge({required this.challengeId});

  final String challengeId;

  factory LoginChallenge.fromJson(Map<String, dynamic> j) =>
      LoginChallenge(challengeId: asString(j['challengeId']));
}

/// Response to `POST /auth/social`: either an existing account is logged in
/// directly, or the email has no account yet and registration must continue
/// via the wizard (see the `2026-07-16-wave2b-registration-wizard` plan).
sealed class SocialLoginOutcome {
  factory SocialLoginOutcome.fromJson(Map<String, dynamic> j) {
    if (j['isNewAccount'] == true) {
      return SocialSignupRequired(
        socialDraftToken: asString(j['socialDraftToken']),
        email: asString(j['email']),
        fullName: asStringOrNull(j['fullName']),
      );
    }
    return SocialLoginSuccess(AuthResult.fromJson(j));
  }
}

class SocialLoginSuccess implements SocialLoginOutcome {
  const SocialLoginSuccess(this.result);
  final AuthResult result;
}

/// No `User` row exists yet for this email — the app must route into the
/// registration wizard with these three fields (name/email prefilled and
/// locked, per spec) rather than showing the classic register form.
class SocialSignupRequired implements SocialLoginOutcome {
  const SocialSignupRequired({
    required this.socialDraftToken,
    required this.email,
    this.fullName,
  });
  final String socialDraftToken;
  final String email;
  final String? fullName;
}
