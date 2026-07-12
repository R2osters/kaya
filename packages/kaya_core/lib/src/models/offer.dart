import 'enums.dart';
import 'json_utils.dart';
import 'user.dart';

/// A driver's price bid on an order. Mirrors backend `offers`, and includes the
/// bidding driver when the API embeds the `livreur` relation.
class Offer {
  const Offer({
    required this.id,
    required this.orderId,
    required this.livreurId,
    required this.proposedPrice,
    required this.minPrice,
    required this.status,
    required this.createdAt,
    this.expiresAt,
    this.driver,
  });

  final String id;
  final String orderId;
  final String livreurId;
  final double proposedPrice;
  final double minPrice;
  final OfferStatus status;
  final DateTime createdAt;
  final DateTime? expiresAt;

  /// Embedded driver profile (name/photo/rating/trips) when present.
  final User? driver;

  factory Offer.fromJson(Map<String, dynamic> j) => Offer(
        id: asString(j['id']),
        orderId: asString(j['orderId']),
        livreurId: asString(j['livreurId']),
        proposedPrice: asDouble(j['proposedPrice']),
        minPrice: asDouble(j['minPrice']),
        status: offerStatusFromWire(j['status'] as String?),
        createdAt: asDate(j['createdAt']),
        expiresAt: asDateOrNull(j['expiresAt']),
        driver: j['livreur'] is Map
            ? User.fromJson(asMap(j['livreur']))
            : null,
      );
}
