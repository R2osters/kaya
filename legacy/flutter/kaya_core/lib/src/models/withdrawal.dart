import 'enums.dart';
import 'json_utils.dart';

/// A driver cash-out request. Mirrors backend `withdrawals`.
class Withdrawal {
  const Withdrawal({
    required this.id,
    required this.livreurId,
    required this.amount,
    required this.method,
    required this.status,
    required this.feeAmount,
    required this.accountDetails,
    required this.requestedAt,
    this.processedAt,
    this.rejectionReason,
  });

  final String id;
  final String livreurId;
  final double amount;
  final WithdrawalMethod method;
  final WithdrawalStatus status;
  final double feeAmount;
  final Map<String, dynamic> accountDetails;
  final DateTime requestedAt;
  final DateTime? processedAt;
  final String? rejectionReason;

  double get netAmount => amount - feeAmount;

  factory Withdrawal.fromJson(Map<String, dynamic> j) => Withdrawal(
        id: asString(j['id']),
        livreurId: asString(j['livreurId']),
        amount: asDouble(j['amount']),
        method: (j['method'] == 'bank_transfer')
            ? WithdrawalMethod.bank_transfer
            : WithdrawalMethod.momo,
        status: withdrawalStatusFromWire(j['status'] as String?),
        feeAmount: asDouble(j['feeAmount']),
        accountDetails: asMap(j['accountDetails']),
        requestedAt: asDate(j['requestedAt']),
        processedAt: asDateOrNull(j['processedAt']),
        rejectionReason: asStringOrNull(j['rejectionReason']),
      );
}
