import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';

final _deliveryProvider =
    FutureProvider.autoDispose.family<Delivery, String>((ref, id) async {
  return ref.read(kayaApiProvider).deliveries.byId(id);
});

/// Commission receipt: gross price, commission (with tier %), litigation fee,
/// net earnings — the driver's per-delivery breakdown.
class DeliveryDetailScreen extends ConsumerWidget {
  const DeliveryDetailScreen({super.key, required this.deliveryId});
  final String deliveryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final currency = ref.watch(currentUserProvider)?.currency ?? Currency.GHS;
    final async = ref.watch(_deliveryProvider(deliveryId));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.driverCommission)),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(child: Text(l10n.commonError)),
        data: (d) {
          final gross = d.basePrice ?? 0;
          final ratePct =
              d.commissionRate == null ? null : (d.commissionRate! * 100).round();
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              KayaCard(
                child: Column(
                  children: [
                    if (d.order != null) ...[
                      _row(l10n.orderDropoff, d.order!.deliveryAddress),
                      const Divider(height: 22),
                    ],
                    _row(l10n.payTotal, Money(gross, currency).format()),
                    const Divider(height: 22),
                    _row(
                      '${l10n.driverCommission}${ratePct != null ? ' ($ratePct%)' : ''}',
                      '- ${Money(d.commissionAmount ?? 0, currency).format()}',
                    ),
                    const Divider(height: 22),
                    _row(l10n.payLitigationFee,
                        '- ${Money(d.litigationFee, currency).format()}'),
                    const Divider(height: 22),
                    _row(l10n.driverNetAfterCommission,
                        Money(d.netEarnings ?? 0, currency).format(),
                        strong: true),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              KayaCard(
                child: Row(
                  children: [
                    Icon(
                      d.status == DeliveryStatus.completed
                          ? Icons.check_circle_rounded
                          : Icons.pending_outlined,
                      color: d.status == DeliveryStatus.completed
                          ? AppColors.success
                          : AppColors.amber,
                    ),
                    const SizedBox(width: 12),
                    Text(d.status.name.replaceAll('_', ' '),
                        style: AppTypography.bodyStrong),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _row(String label, String value, {bool strong = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
            child: Text(label,
                style: strong
                    ? AppTypography.cardTitle
                    : AppTypography.bodySecondary)),
        Text(value,
            style: strong
                ? AppTypography.price.copyWith(color: AppColors.success)
                : AppTypography.bodyStrong),
      ],
    );
  }
}
