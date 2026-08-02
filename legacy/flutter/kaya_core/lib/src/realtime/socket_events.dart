import '../models/json_utils.dart';

/// Typed payloads for server -> client socket events. All use snake_case keys
/// exactly as emitted by the NestJS gateway (see events.gateway.ts contract).

/// server -> 'offer:new' { offerId, orderId, livreurId, proposedPrice }
class OfferNewEvent {
  const OfferNewEvent({
    required this.offerId,
    required this.orderId,
    required this.livreurId,
    required this.proposedPrice,
  });

  final String offerId;
  final String orderId;
  final String livreurId;
  final double proposedPrice;

  factory OfferNewEvent.fromJson(Map<String, dynamic> j) => OfferNewEvent(
        offerId: asString(j['offerId']),
        orderId: asString(j['orderId']),
        livreurId: asString(j['livreurId']),
        proposedPrice: asDouble(j['proposedPrice']),
      );
}

/// server -> 'offer:accepted' { offerId, orderId, deliveryId, livreurId }
class OfferAcceptedEvent {
  const OfferAcceptedEvent({
    required this.offerId,
    required this.orderId,
    required this.deliveryId,
    required this.livreurId,
  });

  final String offerId;
  final String orderId;
  final String deliveryId;
  final String livreurId;

  factory OfferAcceptedEvent.fromJson(Map<String, dynamic> j) =>
      OfferAcceptedEvent(
        offerId: asString(j['offerId']),
        orderId: asString(j['orderId']),
        deliveryId: asString(j['deliveryId']),
        livreurId: asString(j['livreurId']),
      );
}

/// server -> 'location:driver' { livreur_id, lat, lng, timestamp }
class DriverLocationEvent {
  const DriverLocationEvent({
    required this.livreurId,
    required this.lat,
    required this.lng,
    required this.timestamp,
  });

  final String livreurId;
  final double lat;
  final double lng;
  final DateTime timestamp;

  factory DriverLocationEvent.fromJson(Map<String, dynamic> j) =>
      DriverLocationEvent(
        livreurId: asString(j['livreur_id']),
        lat: asDouble(j['lat']),
        lng: asDouble(j['lng']),
        timestamp: asDate(j['timestamp']),
      );
}

/// server -> 'delivery:status' { delivery_id, status, timestamp }
class DeliveryStatusEvent {
  const DeliveryStatusEvent({
    required this.deliveryId,
    required this.status,
    required this.timestamp,
  });

  final String deliveryId;
  final String status;
  final DateTime timestamp;

  factory DeliveryStatusEvent.fromJson(Map<String, dynamic> j) =>
      DeliveryStatusEvent(
        deliveryId: asString(j['delivery_id']),
        status: asString(j['status']),
        timestamp: asDate(j['timestamp']),
      );
}
