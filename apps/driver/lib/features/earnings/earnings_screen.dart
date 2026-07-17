import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';

final _balanceProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(kayaApiProvider).driver.balance();
});

final _earningsProvider =
    FutureProvider.autoDispose<List<Transaction>>((ref) async {
  return ref.read(kayaApiProvider).driver.earnings();
});

final _statsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(kayaApiProvider).driver.stats();
});

class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final user = ref.watch(currentUserProvider);
    final currency = user?.currency ?? Currency.GHS;
    final balance = ref.watch(_balanceProvider);
    final earnings = ref.watch(_earningsProvider);
    final stats = ref.watch(_statsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navEarnings)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_balanceProvider);
          ref.invalidate(_earningsProvider);
          ref.invalidate(_statsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Balance card.
            KayaCard(
              color: AppColors.primary,
              border: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.navEarnings.toUpperCase(),
                      style: AppTypography.overline
                          .copyWith(color: AppColors.surface)),
                  const SizedBox(height: 8),
                  Text(
                    balance.maybeWhen(
                      data: (b) => Money(
                              (b['balance'] as num?)?.toDouble() ??
                                  user?.balance ??
                                  0,
                              currency)
                          .format(),
                      orElse: () =>
                          Money(user?.balance ?? 0, currency).format(),
                    ),
                    style: AppTypography.priceLarge
                        .copyWith(color: AppColors.surface, fontSize: 34),
                  ),
                  const SizedBox(height: 16),
                  KayaButton(
                    label: l10n.driverWithdraw,
                    variant: KayaButtonVariant.secondary,
                    icon: Icons.account_balance_wallet_outlined,
                    onPressed: () => context.push('/withdraw'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(l10n.driverCommissionTiers, style: AppTypography.sectionTitle),
            const SizedBox(height: 12),
            _CommissionTiers(
              deliveriesToday: stats.maybeWhen(
                data: (s) => (s['todayDeliveries'] as num?)?.toInt() ??
                    user?.dailyDeliveries ??
                    0,
                orElse: () => user?.dailyDeliveries ?? 0,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l10n.driverWeeklyEarnings,
                    style: AppTypography.sectionTitle),
                TextButton(
                    onPressed: () => context.push('/stats'),
                    child: Text(l10n.driverStats)),
              ],
            ),
            const SizedBox(height: 8),
            earnings.when(
              loading: () =>
                  const SizedBox(height: 240, child: KayaSkeletonList(count: 3)),
              error: (_, __) => Text(l10n.commonError),
              data: (txns) {
                if (txns.isEmpty) {
                  return EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: l10n.commonEmpty);
                }
                return Column(
                  children: txns
                      .map((t) => _TxnTile(txn: t, currency: currency))
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Visual of the 20/15/12/9% tiers with today's progress highlighted.
class _CommissionTiers extends StatelessWidget {
  const _CommissionTiers({required this.deliveriesToday});
  final int deliveriesToday;

  static const _tiers = [
    ('1–6', 20, 1, 6),
    ('7–10', 15, 7, 10),
    ('11–14', 12, 11, 14),
    ('15+', 9, 15, 999),
  ];

  int get _nextNumber => deliveriesToday + 1;

  @override
  Widget build(BuildContext context) {
    return KayaCard(
      child: Column(
        children: [
          for (final (range, pct, from, to) in _tiers)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _active(from, to)
                          ? AppColors.primary
                          : AppColors.background,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text('$pct%',
                          style: AppTypography.caption.copyWith(
                            color: _active(from, to)
                                ? AppColors.surface
                                : AppColors.inkSecondary,
                            fontWeight: FontWeight.w800,
                          )),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                        KayaL10n.of(context).driverDeliveryRange(range),
                        style: AppTypography.bodyStrong),
                  ),
                  if (_active(from, to))
                    StatusPill(
                        label: KayaL10n.of(context).driverTierCurrent,
                        tone: StatusTone.primary,
                        dense: true),
                ],
              ),
            ),
        ],
      ),
    );
  }

  bool _active(int from, int to) => _nextNumber >= from && _nextNumber <= to;
}

class _TxnTile extends StatelessWidget {
  const _TxnTile({required this.txn, required this.currency});
  final Transaction txn;
  final Currency currency;

  @override
  Widget build(BuildContext context) {
    final credit = txn.isCredit;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: credit ? AppColors.successTint : AppColors.background,
        child: Icon(
          credit ? Icons.south_west_rounded : Icons.north_east_rounded,
          color: credit ? AppColors.success : AppColors.inkSecondary,
          size: 18,
        ),
      ),
      title: Text(txn.type.name.replaceAll('_', ' '),
          style: AppTypography.bodyStrong),
      subtitle: Text(DateFormat('d MMM, HH:mm').format(txn.createdAt),
          style: AppTypography.caption),
      trailing: Text(
        '${credit ? '+' : '-'}${Money(txn.amount, currency).format()}',
        style: AppTypography.bodyStrong.copyWith(
            color: credit ? AppColors.success : AppColors.ink),
      ),
    );
  }
}
