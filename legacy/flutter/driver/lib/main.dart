import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:kaya_core/kaya_core.dart';

import 'app.dart';
import 'map/google_map_view.dart';
import 'map/osm_map_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: kIsWeb ? kayaFirebaseWebOptions : null,
  );
  // Load FR/EN date symbols so localized DateFormat (weekday, month) works.
  initializeDateFormatting();
  // Google Maps needs a paid API key (MAPS_API_KEY dart-define). Until one is
  // configured, use OpenStreetMap (free, no key) so the map is always real
  // and interactive rather than the stylized fallback.
  if (const String.fromEnvironment('MAPS_API_KEY').isNotEmpty) {
    registerGoogleMaps();
  } else {
    registerOsmMaps();
  }
  runApp(const ProviderScope(child: KayaDriverApp()));
}
