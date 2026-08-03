import 'enums.dart';
import 'geo_point.dart';
import 'json_utils.dart';

/// A delivery order created by a client. Mirrors backend `orders`.
class Order {
  const Order({
    required this.id,
    required this.clientId,
    required this.pickupAddress,
    required this.pickup,
    required this.deliveryAddress,
    required this.dropoff,
    required this.status,
    this.description,
    this.packagePhoto,
    this.weightKg,
    this.dimensions,
    this.scheduledTime,
    this.publishedAt,
    this.minPriceSuggested,
    this.distanceKm,
    this.acceptedOfferId,
    required this.createdAt,
  });

  final String id;
  final String clientId;
  final String pickupAddress;
  final GeoPoint pickup;
  final String deliveryAddress;
  final GeoPoint dropoff;
  final OrderStatus status;
  final String? description;
  final String? packagePhoto;
  final double? weightKg;
  final String? dimensions;
  final DateTime? scheduledTime;
  final DateTime? publishedAt;
  final double? minPriceSuggested;
  final double? distanceKm;
  final String? acceptedOfferId;
  final DateTime createdAt;

  bool get isScheduled => scheduledTime != null;
  bool get isLive =>
      status == OrderStatus.published || status == OrderStatus.offers_received;

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: asString(j['id']),
        clientId: asString(j['clientId']),
        pickupAddress: asString(j['pickupAddress']),
        pickup: GeoPoint(asDouble(j['pickupLat']), asDouble(j['pickupLng'])),
        deliveryAddress: asString(j['deliveryAddress']),
        dropoff:
            GeoPoint(asDouble(j['deliveryLat']), asDouble(j['deliveryLng'])),
        status: orderStatusFromWire(j['status'] as String?),
        description: asStringOrNull(j['description']),
        packagePhoto: asStringOrNull(j['packagePhoto']),
        weightKg: asDoubleOrNull(j['weightKg']),
        dimensions: asStringOrNull(j['dimensions']),
        scheduledTime: asDateOrNull(j['scheduledTime']),
        publishedAt: asDateOrNull(j['publishedAt']),
        minPriceSuggested: asDoubleOrNull(j['minPriceSuggested']),
        distanceKm: asDoubleOrNull(j['distanceKm']),
        acceptedOfferId: asStringOrNull(j['acceptedOfferId']),
        createdAt: asDate(j['createdAt']),
      );
}
