import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';

final deliveryHistoryProvider =
    FutureProvider.autoDispose<List<Delivery>>((ref) async {
  return ref.read(kayaApiProvider).deliveries.mine();
});

class DeliveryHistoryScreen extends ConsumerWidget {
  const DeliveryHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final currency = ref.watch(currentUserProvider)?.currency ?? Currency.GHS;
    final async = ref.watch(deliveryHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navHistory)),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(child: Text(l10n.commonError)),
        data: (deliveries) {
          if (deliveries.isEmpty) {
            return EmptyState(
                icon: Icons.local_shipping_outlined,
                title: l10n.historyEmpty);
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: deliveries.length,
            itemBuilder: (_, i) {
              final d = deliveries[i];
              final done = d.status == DeliveryStatus.completed;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: KayaCard(
                  onTap: () {
                    if (done) {
                      context.push('/delivery-detail/${d.id}');
                    } else {
                      context.push('/delivery/${d.id}');
                    }
                  },
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: done
                              ? AppColors.successTint
                              : AppColors.primaryTint,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          done
                              ? Icons.check_rounded
                              : Icons.local_shipping_outlined,
                          color: done ? AppColors.success : AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                                d.order?.deliveryAddress ??
                                    '#${d.orderId.substring(0, 8).toUpperCase()}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.bodyStrong),
                            Text(DateFormat('d MMM yyyy').format(d.createdAt),
                                style: AppTypography.caption),
                          ],
                        ),
                      ),
                      if (d.netEarnings != null)
                        Text(Money(d.netEarnings!, currency).format(),
                            style: AppTypography.bodyStrong
                                .copyWith(color: AppColors.success)),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
