import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:firebase_core/firebase_core.dart';

import 'app.dart';
import 'map/google_map_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  // Load FR/EN date symbols so localized DateFormat (weekday, month) works.
  initializeDateFormatting();
  // Plug google_maps_flutter into the MapView abstraction (used only when a
  // MAPS_API_KEY dart-define is present; stylized fallback stays the default).
  registerGoogleMaps();
  runApp(const ProviderScope(child: KayaDriverApp()));
}
