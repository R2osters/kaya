import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../models/geo_point.dart';

/// Wraps geolocator: permission handling, a position stream for live driver
/// tracking, and a last-known cache so screens still render offline.
class LocationService {
  GeoPoint? _lastKnown;

  /// The most recent fix we obtained, if any (survives brief GPS loss).
  GeoPoint? get lastKnown => _lastKnown;

  /// Ensures location services are on and permission is granted.
  /// Returns false if the user denied it (caller shows a rationale/fallback).
  Future<bool> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  /// A single current fix. Falls back to the platform's last-known position,
  /// then to our in-memory cache, so callers get *something* usable.
  Future<GeoPoint?> current() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      return _cache(GeoPoint(pos.latitude, pos.longitude));
    } catch (_) {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        return _cache(GeoPoint(last.latitude, last.longitude));
      }
      return _lastKnown;
    }
  }

  /// Continuous position updates (driver online). Emits when the device moves
  /// at least [distanceFilter] meters. Cache is updated on every tick.
  Stream<GeoPoint> stream({int distanceFilter = 15}) {
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilter,
      ),
    ).map((pos) => _cache(GeoPoint(pos.latitude, pos.longitude)));
  }

  GeoPoint _cache(GeoPoint p) {
    _lastKnown = p;
    return p;
  }
}
