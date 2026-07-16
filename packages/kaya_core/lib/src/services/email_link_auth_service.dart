import 'package:firebase_auth/firebase_auth.dart';

/// Wraps Firebase's email-link ("magic link") sign-in. The Android package
/// name and iOS bundle ID differ between the client and driver apps, so
/// callers supply them rather than this shared service hardcoding one.
///
/// NOTE: exercising this end-to-end requires a Firebase Hosting site serving
/// the deep-link well-known files and a physical device — neither exists yet
/// in this environment (spec Risk #3). The code is correct against the
/// Firebase Auth API; on-device verification is a manual QA step.
abstract interface class EmailLinkAuthService {
  Future<void> sendSignInLink({
    required String email,
    required String continueUrl,
    required String androidPackageName,
    required String iosBundleId,
  });

  bool isSignInLink(String link);

  Future<String> completeSignIn({required String email, required String emailLink});
}

class FirebaseEmailLinkAuthService implements EmailLinkAuthService {
  FirebaseEmailLinkAuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;

  @override
  Future<void> sendSignInLink({
    required String email,
    required String continueUrl,
    required String androidPackageName,
    required String iosBundleId,
  }) {
    return _auth.sendSignInLinkToEmail(
      email: email,
      actionCodeSettings: ActionCodeSettings(
        url: continueUrl,
        handleCodeInApp: true,
        androidPackageName: androidPackageName,
        androidInstallApp: true,
        androidMinimumVersion: '21',
        iOSBundleId: iosBundleId,
      ),
    );
  }

  @override
  bool isSignInLink(String link) => _auth.isSignInWithEmailLink(link);

  @override
  Future<String> completeSignIn({required String email, required String emailLink}) async {
    final result = await _auth.signInWithEmailLink(email: email, emailLink: emailLink);
    final idToken = await result.user?.getIdToken();
    if (idToken == null) {
      throw StateError('Firebase did not return an ID token.');
    }
    return idToken;
  }
}
