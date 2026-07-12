import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

/// Published orders near the driver (PostGIS radius search). Refresh to poll;
/// the socket also pushes new publications when online.
final nearbyOrdersProvider =
    FutureProvider.autoDispose<List<Order>>((ref) async {
  final location = ref.read(locationServiceProvider);
  final pos = await location.current();
  return ref.read(kayaApiProvider).orders.nearby(
        lat: pos?.lat,
        lng: pos?.lng,
      );
});

/// Today's stats for the home header (deliveries count, earnings, tier).
final driverStatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(kayaApiProvider).driver.stats();
});
