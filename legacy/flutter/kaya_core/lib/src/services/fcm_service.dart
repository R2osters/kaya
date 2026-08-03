import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';

/// Thin wrapper over firebase_messaging.
///
/// Guarded: every call is wrapped so the app runs on a device/emulator with no
/// Firebase configuration (no google-services.json / GoogleService-Info.plist).
/// [init] returns the FCM token to register with the backend, or null when
/// Firebase isn't available — the app degrades to socket + REST polling.
class FcmService {
  FcmService._();
  static final FcmService instance = FcmService._();

  final _messages = StreamController<RemoteMessage>.broadcast();

  /// Foreground push messages (empty stream when Firebase is absent).
  Stream<RemoteMessage> get onMessage => _messages.stream;

  bool _available = false;
  bool get isAvailable => _available;

  /// Requests permission and returns the device token, or null if Firebase is
  /// not configured. Never throws.
  Future<String?> init() async {
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      FirebaseMessaging.onMessage.listen(_messages.add);
      final token = await messaging.getToken();
      _available = token != null;
      return token;
    } catch (_) {
      // Firebase.initializeApp() was never called / no config — degrade quietly.
      _available = false;
      return null;
    }
  }

  Future<void> dispose() => _messages.close();
}
