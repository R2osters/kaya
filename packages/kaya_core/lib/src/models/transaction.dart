import '../constants.dart';
import 'enums.dart';
import 'json_utils.dart';

/// A ledger entry. Mirrors backend `transactions` (append-only ledger).
class Transaction {
  const Transaction({
    required this.id,
    required this.userId,
    this.deliveryId,
    required this.type,
    required this.amount,
    required this.currency,
    required this.status,
    this.reference,
    required this.createdAt,
  });

  final String id;
  final String userId;
  final String? deliveryId;
  final TransactionType type;
  final double amount;
  final Currency currency;
  final String status;
  final String? reference;
  final DateTime createdAt;

  /// Credits (money in) vs debits (money out) from the driver's perspective.
  bool get isCredit =>
      type == TransactionType.driver_payout ||
      type == TransactionType.escrow_release ||
      type == TransactionType.refund;

  factory Transaction.fromJson(Map<String, dynamic> j) => Transaction(
        id: asString(j['id']),
        userId: asString(j['userId']),
        deliveryId: asStringOrNull(j['deliveryId']),
        type: transactionTypeFromWire(j['type'] as String?),
        amount: asDouble(j['amount']),
        currency: CurrencyX.fromWire(j['currency'] as String?),
        status: asString(j['status'], 'completed'),
        reference: asStringOrNull(j['reference']),
        createdAt: asDate(j['createdAt']),
      );
}
