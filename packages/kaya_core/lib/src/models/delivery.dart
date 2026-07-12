import 'enums.dart';
import 'json_utils.dart';
import 'order.dart';
import 'user.dart';

/// An accepted order in execution. Mirrors backend `deliveries`, with optional
/// embedded `order` and `livreur` relations.
class Delivery {
  const Delivery({
    required this.id,
    required this.orderId,
    required this.livreurId,
    required this.status,
    required this.clientPaymentStatus,
    this.pickupPhoto,
    this.deliveryPhoto,
    this.startTime,
    this.pickupTime,
    this.deliveryTime,
    this.deliveryConfirmedAt,
    this.distanceKm,
    this.basePrice,
    this.commissionRate,
    this.commissionAmount,
    this.litigationFee = 1,
    this.netEarnings,
    required this.createdAt,
    this.order,
    this.driver,
  });

  final String id;
  final String orderId;
  final String livreurId;
  final DeliveryStatus status;
  final ClientPaymentStatus clientPaymentStatus;
  final String? pickupPhoto;
  final String? deliveryPhoto;
  final DateTime? startTime;
  final DateTime? pickupTime;
  final DateTime? deliveryTime;
  final DateTime? deliveryConfirmedAt;
  final double? distanceKm;
  final double? basePrice;
  final double? commissionRate;
  final double? commissionAmount;
  final double litigationFee;
  final double? netEarnings;
  final DateTime createdAt;

  final Order? order;
  final User? driver;

  /// Maps the delivery lifecycle onto the 4-step tracking timeline.
  /// 0 = en route, 1 = picked up, 2 = in transit, 3 = delivered.
  int get timelineStep {
    if (deliveryTime != null || status == DeliveryStatus.completed) return 3;
    if (pickupTime != null) {
      // transit begins after pickup; treat a set pickup as "picked up" and
      // rely on the order status for the transit refinement in the UI.
      return order?.status == OrderStatus.in_transit ? 2 : 1;
    }
    return 0;
  }

  factory Delivery.fromJson(Map<String, dynamic> j) => Delivery(
        id: asString(j['id']),
        orderId: asString(j['orderId']),
        livreurId: asString(j['livreurId']),
        status: deliveryStatusFromWire(j['status'] as String?),
        clientPaymentStatus:
            clientPaymentStatusFromWire(j['clientPaymentStatus'] as String?),
        pickupPhoto: asStringOrNull(j['pickupPhoto']),
        deliveryPhoto: asStringOrNull(j['deliveryPhoto']),
        startTime: asDateOrNull(j['startTime']),
        pickupTime: asDateOrNull(j['pickupTime']),
        deliveryTime: asDateOrNull(j['deliveryTime']),
        deliveryConfirmedAt: asDateOrNull(j['deliveryConfirmedAt']),
        distanceKm: asDoubleOrNull(j['distanceKm']),
        basePrice: asDoubleOrNull(j['basePrice']),
        commissionRate: asDoubleOrNull(j['commissionRate']),
        commissionAmount: asDoubleOrNull(j['commissionAmount']),
        litigationFee: asDouble(j['litigationFee'], 1),
        netEarnings: asDoubleOrNull(j['netEarnings']),
        createdAt: asDate(j['createdAt']),
        order: j['order'] is Map ? Order.fromJson(asMap(j['order'])) : null,
        driver:
            j['livreur'] is Map ? User.fromJson(asMap(j['livreur'])) : null,
      );
}
