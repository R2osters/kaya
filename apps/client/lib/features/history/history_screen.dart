import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import '../../widgets/brand_app_bar.dart';

final ordersHistoryProvider =
    FutureProvider.autoDispose<List<Order>>((ref) async {
  return ref.read(kayaApiProvider).orders.mine();
});

/// Two tabs: past deliveries and scheduled (future) orders.
class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final async = ref.watch(ordersHistoryProvider);
    final currency = ref.watch(currentUserProvider)?.currency ?? Currency.GHS;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: BrandAppBar(showBell: false, onMenu: () {}),
        body: Column(
          children: [
            TabBar(
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.inkSecondary,
              indicatorColor: AppColors.primary,
              tabs: [
                Tab(text: l10n.historyPast),
                Tab(text: l10n.historyScheduled),
              ],
            ),
            Expanded(
              child: async.when(
                loading: () => const KayaSkeletonList(),
                error: (_, __) => Center(child: Text(l10n.commonError)),
                data: (orders) {
                  final scheduled =
                      orders.where((o) => o.isScheduled && o.status != OrderStatus.delivered).toList();
                  final past = orders
                      .where((o) =>
                          o.status == OrderStatus.delivered ||
                          o.status == OrderStatus.cancelled)
                      .toList();
                  return TabBarView(
                    children: [
                      _OrderList(orders: past, currency: currency, empty: l10n.historyEmpty),
                      _OrderList(
                          orders: scheduled,
                          currency: currency,
                          empty: l10n.historyEmpty),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderList extends StatelessWidget {
  const _OrderList(
      {required this.orders, required this.currency, required this.empty});
  final List<Order> orders;
  final Currency currency;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return EmptyState(
          icon: Icons.inbox_outlined, title: empty, message: null);
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: orders.length,
      itemBuilder: (_, i) {
        final o = orders[i];
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: KayaCard(
            onTap: () {
              if (o.acceptedOfferId != null) {
                context.push('/tracking/${o.id}');
              }
            },
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    o.isScheduled
                        ? Icons.event_rounded
                        : Icons.local_shipping_outlined,
                    color: AppColors.inkSecondary,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(o.deliveryAddress,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyStrong),
                      const SizedBox(height: 2),
                      Text(
                        o.scheduledTime != null
                            ? DateFormat('d MMM, HH:mm').format(o.scheduledTime!)
                            : DateFormat('d MMM yyyy').format(o.createdAt),
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
                if (o.minPriceSuggested != null)
                  Text(Money(o.minPriceSuggested!, currency).format(),
                      style: AppTypography.bodyStrong),
              ],
            ),
          ),
        );
      },
    );
  }
}
