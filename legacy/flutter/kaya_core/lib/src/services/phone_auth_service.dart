import 'package:firebase_auth/firebase_auth.dart';

/// Wraps Firebase Phone Auth's verify/confirm flow so onboarding screens
/// never touch the Firebase SDK directly (see
/// docs/superpowers/specs/2026-07-12-firebase-phone-auth-design.md).
abstract interface class PhoneAuthService {
  /// Starts phone verification for [phone]. Calls [onCodeSent] with a
  /// verification id once the SMS (or the whitelisted dev test number) has
  /// been dispatched, or [onError] with a human-readable message on failure.
  Future<void> sendCode({
    required String phone,
    required void Function(String verificationId) onCodeSent,
    required void Function(String message) onError,
  });

  /// Confirms the code the user typed and returns a Firebase ID token
  /// proving ownership of the phone number passed to [sendCode].
  Future<String> confirmCode({
    required String verificationId,
    required String smsCode,
  });
}

class FirebasePhoneAuthService implements PhoneAuthService {
  FirebasePhoneAuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;

  @override
  Future<void> sendCode({
    required String phone,
    required void Function(String verificationId) onCodeSent,
    required void Function(String message) onError,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phone,
      timeout: const Duration(seconds: 60),
      // Android auto-retrieval fires this without user input; we still let
      // the code screen drive confirmation explicitly for a uniform flow
      // across Android/iOS/test numbers, so this is intentionally a no-op.
      verificationCompleted: (_) {},
      verificationFailed: (e) => onError(e.message ?? 'Phone verification failed.'),
      codeSent: (verificationId, _) => onCodeSent(verificationId),
      codeAutoRetrievalTimeout: (_) {},
    );
  }

  @override
  Future<String> confirmCode({
    required String verificationId,
    required String smsCode,
  }) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode,
    );
    final result = await _auth.signInWithCredential(credential);
    final idToken = await result.user?.getIdToken();
    if (idToken == null) {
      throw StateError('Firebase did not return an ID token.');
    }
    return idToken;
  }
}
