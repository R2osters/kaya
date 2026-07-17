import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:kaya_core/kaya_core.dart';
import 'package:latlong2/latlong.dart' as ll;

/// Free, no-key map implementation using OpenStreetMap tiles via flutter_map.
/// Plugged into [MapView] via [registerOsmMaps] when no MAPS_API_KEY is set
/// (see google_map_view.dart for the paid alternative once billing is set up).
class OsmMapView extends StatelessWidget {
  const OsmMapView({super.key, required this.config});

  final MapViewConfig config;

  ll.LatLng get _center {
    final center = config.center ??
        (config.markers.isNotEmpty
            ? config.markers.first.point
            : const GeoPoint(5.6037, -0.187)); // Accra fallback
    return ll.LatLng(center.lat, center.lng);
  }

  @override
  Widget build(BuildContext context) {
    return FlutterMap(
      options: MapOptions(initialCenter: _center, initialZoom: 13),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.kaya.kaya_driver',
        ),
        if (config.route.length >= 2)
          PolylineLayer(
            polylines: [
              Polyline(
                points: config.route
                    .map((p) => ll.LatLng(p.lat, p.lng))
                    .toList(),
                color: AppColors.primary,
                strokeWidth: 4,
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            for (final m in config.markers)
              Marker(
                point: ll.LatLng(m.point.lat, m.point.lng),
                width: m.isVehicle ? 28 : 22,
                height: m.isVehicle ? 28 : 22,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: m.color,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Registers OpenStreetMap as the [MapView] provider. Free, no API key — the
/// default until a Google Maps key is configured (see registerGoogleMaps()).
void registerOsmMaps() {
  MapView.factory = (config) => OsmMapView(config: config);
}
