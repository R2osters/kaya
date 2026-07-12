// Wire enums mirroring the Prisma schema. Parsed from the string the API
// sends; unknown values fall back to a safe default rather than throwing.
//
// Values intentionally use snake_case to match the backend wire format exactly
// — `.name` is serialized/compared against the API string.
// ignore_for_file: constant_identifier_names

enum UserRole { client, livreur, both, admin }

UserRole userRoleFromWire(String? v) => UserRole.values.firstWhere(
      (e) => e.name == v,
      orElse: () => UserRole.client,
    );

enum VehicleType { moto, voiture, camionnette }

VehicleType? vehicleTypeFromWire(String? v) =>
    v == null ? null : VehicleType.values.where((e) => e.name == v).firstOrNull;

enum OrderStatus {
  draft,
  published,
  offers_received,
  accepted,
  driver_en_route,
  picked_up,
  in_transit,
  delivered,
  cancelled,
  disputed,
}

OrderStatus orderStatusFromWire(String? v) => OrderStatus.values.firstWhere(
      (e) => e.name == v,
      orElse: () => OrderStatus.draft,
    );

enum OfferStatus { pending, accepted, rejected, expired }

OfferStatus offerStatusFromWire(String? v) => OfferStatus.values.firstWhere(
      (e) => e.name == v,
      orElse: () => OfferStatus.pending,
    );

enum DeliveryStatus { in_progress, completed, cancelled, disputed }

DeliveryStatus deliveryStatusFromWire(String? v) =>
    DeliveryStatus.values.firstWhere(
      (e) => e.name == v,
      orElse: () => DeliveryStatus.in_progress,
    );

enum ClientPaymentStatus { pending, escrow_held, released, refunded }

ClientPaymentStatus clientPaymentStatusFromWire(String? v) =>
    ClientPaymentStatus.values.firstWhere(
      (e) => e.name == v,
      orElse: () => ClientPaymentStatus.pending,
    );

enum TransactionType {
  payment_in,
  escrow_release,
  commission,
  litigation_fee,
  driver_payout,
  withdrawal,
  refund,
  adjustment,
}

TransactionType transactionTypeFromWire(String? v) =>
    TransactionType.values.firstWhere(
      (e) => e.name == v,
      orElse: () => TransactionType.adjustment,
    );

enum WithdrawalMethod { momo, bank_transfer }

enum WithdrawalStatus { pending, processing, completed, failed }

WithdrawalStatus withdrawalStatusFromWire(String? v) =>
    WithdrawalStatus.values.firstWhere(
      (e) => e.name == v,
      orElse: () => WithdrawalStatus.pending,
    );

enum NotificationType {
  order,
  offer,
  delivery,
  payment,
  withdrawal,
  rating,
  system,
}

NotificationType notificationTypeFromWire(String? v) =>
    NotificationType.values.firstWhere(
      (e) => e.name == v,
      orElse: () => NotificationType.system,
    );

enum OtpPurpose {
  registration,
  login,
  password_reset,
  phone_verification,
}
