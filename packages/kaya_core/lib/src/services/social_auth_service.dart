import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

enum SocialProvider { google, facebook }

/// Wraps the native Google/Facebook sign-in SDKs so onboarding screens never
/// touch them directly (mirrors PhoneAuthService's role for phone auth). A
/// `null` return means the user cancelled the native picker — not an error.
abstract interface class SocialAuthService {
  Future<String?> signIn(SocialProvider provider);
}

class FirebaseSocialAuthService implements SocialAuthService {
  FirebaseSocialAuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;

  @override
  Future<String?> signIn(SocialProvider provider) async {
    final credential = switch (provider) {
      SocialProvider.google => await _googleCredential(),
      SocialProvider.facebook => await _facebookCredential(),
    };
    if (credential == null) return null;
    final result = await _auth.signInWithCredential(credential);
    return result.user?.getIdToken();
  }

  Future<AuthCredential?> _googleCredential() async {
    final googleUser = await GoogleSignIn().signIn();
    if (googleUser == null) return null;
    final googleAuth = await googleUser.authentication;
    return GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
  }

  Future<AuthCredential?> _facebookCredential() async {
    final result = await FacebookAuth.instance.login();
    if (result.status != LoginStatus.success || result.accessToken == null) return null;
    return FacebookAuthProvider.credential(result.accessToken!.tokenString);
  }
}
