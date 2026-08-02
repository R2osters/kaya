import 'package:firebase_core/firebase_core.dart';

/// Default Firebase options for web builds (dev/QA only — see BLUEPRINT.md,
/// web is out of v1 product scope; this exists purely to allow `flutter run
/// -d chrome` for local testing where Android/iOS devices aren't attached).
/// On Android/iOS these come from google-services.json /
/// GoogleService-Info.plist automatically, so this is only used when
/// `kIsWeb` is true.
///
/// Values are the real config for the "Kaya Web (dev)" app registered in the
/// kaya-a24e7 Firebase project (Project settings > General).
FirebaseOptions get kayaFirebaseWebOptions => const FirebaseOptions(
      apiKey: 'AIzaSyDQJAKpOxQnBccgix3HhwYqG-WDs_eqa2w',
      appId: '1:378812428091:web:cd7b7dc87b1c1da1de111e',
      messagingSenderId: '378812428091',
      projectId: 'kaya-a24e7',
      authDomain: 'kaya-a24e7.firebaseapp.com',
      storageBucket: 'kaya-a24e7.firebasestorage.app',
    );
