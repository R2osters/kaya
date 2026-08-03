import 'json_utils.dart';

/// A latitude/longitude pair.
class GeoPoint {
  const GeoPoint(this.lat, this.lng);

  final double lat;
  final double lng;

  factory GeoPoint.fromJson(Map<String, dynamic> j) =>
      GeoPoint(asDouble(j['lat']), asDouble(j['lng']));

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng};

  @override
  bool operator ==(Object other) =>
      other is GeoPoint && other.lat == lat && other.lng == lng;

  @override
  int get hashCode => Object.hash(lat, lng);
}
