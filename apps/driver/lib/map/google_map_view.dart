import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:kaya_core/kaya_core.dart';

/// Concrete google_maps_flutter implementation plugged into [MapView] via
/// [registerGoogleMaps]. Only used when a MAPS_API_KEY dart-define is present;
/// otherwise kaya_core's stylized fallback renders instead.
class GoogleMapView extends StatelessWidget {
  const GoogleMapView({super.key, required this.config});

  final MapViewConfig config;

  CameraPosition get _initialCamera {
    final center = config.center ??
        (config.markers.isNotEmpty
            ? config.markers.first.point
            : const GeoPoint(5.6037, -0.187));
    return CameraPosition(target: LatLng(center.lat, center.lng), zoom: 13);
  }

  Set<Marker> get _markers => {
        for (var i = 0; i < config.markers.length; i++)
          Marker(
            markerId: MarkerId('m$i'),
            position: LatLng(
                config.markers[i].point.lat, config.markers[i].point.lng),
            icon: BitmapDescriptor.defaultMarkerWithHue(
              _hueFor(config.markers[i]),
            ),
          ),
      };

  Set<Polyline> get _polylines {
    if (config.route.length < 2) return const {};
    return {
      Polyline(
        polylineId: const PolylineId('route'),
        color: AppColors.primary,
        width: 4,
        points: config.route.map((p) => LatLng(p.lat, p.lng)).toList(),
      ),
    };
  }

  double _hueFor(MapMarker m) {
    if (m.color == AppColors.markerPickup) return BitmapDescriptor.hueGreen;
    if (m.isVehicle) return BitmapDescriptor.hueAzure;
    return BitmapDescriptor.hueBlue;
  }

  @override
  Widget build(BuildContext context) {
    return GoogleMap(
      initialCameraPosition: _initialCamera,
      markers: _markers,
      polylines: _polylines,
      myLocationEnabled: config.showUserLocation,
      myLocationButtonEnabled: false,
      zoomControlsEnabled: false,
      compassEnabled: false,
    );
  }
}

/// Registers the Google map as the [MapView] provider. Call once at startup.
void registerGoogleMaps() {
  MapView.factory = (config) => GoogleMapView(config: config);
}
