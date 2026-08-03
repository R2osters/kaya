import 'package:kaya_core/kaya_core.dart';

/// A selectable place. In production these come from Google Places autocomplete;
/// here we ship a small illustrative Accra set (the design notes state maps and
/// positions are illustrative in v1).
class Place {
  const Place({required this.name, required this.area, required this.point});
  final String name;
  final String area;
  final GeoPoint point;
}

const kSampleplaces = <Place>[
  Place(name: 'Osu Oxford Street', area: 'Accra', point: GeoPoint(5.5560, -0.1826)),
  Place(name: 'East Legon ANC Mall', area: 'Accra', point: GeoPoint(5.6360, -0.1550)),
  Place(name: 'Cantonments Post Office', area: 'Accra', point: GeoPoint(5.5810, -0.1720)),
  Place(name: 'Kotoka Int. Airport', area: 'Accra', point: GeoPoint(5.6052, -0.1668)),
  Place(name: 'Accra Mall', area: 'Tetteh Quarshie', point: GeoPoint(5.6209, -0.1717)),
  Place(name: 'Makola Market', area: 'Accra Central', point: GeoPoint(5.5470, -0.2100)),
  Place(name: 'Labadi Beach', area: 'La', point: GeoPoint(5.5560, -0.1490)),
  Place(name: 'Korle Bu Teaching Hospital', area: 'Accra', point: GeoPoint(5.5370, -0.2260)),
];
