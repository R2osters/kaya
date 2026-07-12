import 'package:flutter/material.dart';

import '../models/geo_point.dart';
import '../theme/app_colors.dart';

/// A marker to draw on the map.
class MapMarker {
  const MapMarker({
    required this.point,
    required this.color,
    this.label,
    this.isVehicle = false,
  });

  final GeoPoint point;
  final Color color;
  final String? label;
  final bool isVehicle;

  static MapMarker pickup(GeoPoint p, {String? label}) =>
      MapMarker(point: p, color: AppColors.markerPickup, label: label);
  static MapMarker dropoff(GeoPoint p, {String? label}) =>
      MapMarker(point: p, color: AppColors.markerDropoff, label: label);
  static MapMarker vehicle(GeoPoint p) =>
      MapMarker(point: p, color: AppColors.primary, isVehicle: true);
}

/// Map abstraction: a real Google map when an API key is provided at build time,
/// otherwise a stylized "silver/retro" fallback so the app is fully usable in
/// dev and demos without a key.
///
///   flutter run --dart-define=MAPS_API_KEY=...
///
/// The concrete google_maps_flutter implementation is provided by the host app
/// (which registers [factory]); kaya_core ships only the interface + fallback so
/// the shared package has no hard dependency on the maps plugin.
abstract class MapView extends StatelessWidget {
  const MapView({super.key});

  /// Host apps set this once at startup to plug in a google_maps_flutter view.
  /// When null (no key / not registered), [StylizedMapFallback] is used.
  static Widget Function(MapViewConfig config)? factory;

  static bool get hasProvider =>
      factory != null &&
      const String.fromEnvironment('MAPS_API_KEY').isNotEmpty;

  static Widget build2({
    Key? key,
    GeoPoint? center,
    List<MapMarker> markers = const [],
    List<GeoPoint> route = const [],
    bool showUserLocation = false,
  }) {
    final config = MapViewConfig(
      center: center,
      markers: markers,
      route: route,
      showUserLocation: showUserLocation,
    );
    if (hasProvider) return factory!(config);
    return StylizedMapFallback(key: key, config: config);
  }
}

class MapViewConfig {
  const MapViewConfig({
    this.center,
    this.markers = const [],
    this.route = const [],
    this.showUserLocation = false,
  });

  final GeoPoint? center;
  final List<MapMarker> markers;
  final List<GeoPoint> route;
  final bool showUserLocation;
}

/// Stylized placeholder map. Renders a muted grid, a blue route polyline and
/// the markers so tracking/home screens look right without Google Maps.
class StylizedMapFallback extends StatelessWidget {
  const StylizedMapFallback({super.key, required this.config});

  final MapViewConfig config;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFEDEFF3), Color(0xFFE3E7EE)],
        ),
      ),
      child: CustomPaint(
        painter: _MapPainter(config),
        child: const SizedBox.expand(),
      ),
    );
  }
}

class _MapPainter extends CustomPainter {
  _MapPainter(this.config);
  final MapViewConfig config;

  @override
  void paint(Canvas canvas, Size size) {
    // Muted street grid.
    final grid = Paint()
      ..color = const Color(0xFFFFFFFF).withOpacity(0.6)
      ..strokeWidth = 2;
    const step = 46.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    // A representative water/coast band (like the reference Accra maps).
    final water = Paint()..color = const Color(0xFFBFE0F2).withOpacity(0.7);
    final path = Path()
      ..moveTo(0, size.height * 0.82)
      ..lineTo(size.width, size.height * 0.68)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(path, water);

    // Blue route between the first and last markers.
    if (config.markers.length >= 2) {
      final a = _project(config.markers.first.point, size);
      final b = _project(config.markers.last.point, size);
      final routePaint = Paint()
        ..color = AppColors.primary
        ..strokeWidth = 4
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;
      final mid = Offset((a.dx + b.dx) / 2, a.dy - 40);
      final route = Path()
        ..moveTo(a.dx, a.dy)
        ..quadraticBezierTo(mid.dx, mid.dy, b.dx, b.dy);
      canvas.drawPath(route, routePaint);
    }

    for (final marker in config.markers) {
      final p = _project(marker.point, size);
      final paint = Paint()..color = marker.color;
      if (marker.isVehicle) {
        canvas.drawCircle(p, 12, Paint()..color = marker.color.withOpacity(0.25));
        canvas.drawCircle(p, 7, paint);
      } else {
        canvas.drawCircle(p, 9, paint);
        canvas.drawCircle(p, 3.5, Paint()..color = Colors.white);
      }
    }
  }

  /// Deterministic pseudo-projection: spreads markers across the canvas based
  /// on their coordinates (fallback only — no real geo projection needed).
  Offset _project(GeoPoint p, Size size) {
    final fx = (p.lng.abs() * 1000 % 100) / 100;
    final fy = (p.lat.abs() * 1000 % 100) / 100;
    return Offset(
      size.width * (0.2 + 0.6 * fx),
      size.height * (0.25 + 0.45 * fy),
    );
  }

  @override
  bool shouldRepaint(covariant _MapPainter old) =>
      old.config != config;
}
