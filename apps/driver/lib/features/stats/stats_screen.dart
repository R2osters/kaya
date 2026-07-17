import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';

final _statsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(kayaApiProvider).driver.stats();
});

/// Performance overview: weekly earnings, acceptance rate, punctuality, rating.
class StatsScreen extends ConsumerWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final user = ref.watch(currentUserProvider);
    final currency = user?.currency ?? Currency.GHS;
    final stats = ref.watch(_statsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.driverStats)),
      body: stats.when(
        loading: () => const KayaSkeletonCard(),
        error: (_, __) => Center(child: Text(l10n.commonError)),
        data: (s) {
          final weekly = (s['weeklyEarnings'] as num?)?.toDouble() ?? 0;
          final acceptance = (s['acceptanceRate'] as num?)?.toDouble() ?? 0.92;
          final punctuality = (s['punctuality'] as num?)?.toDouble() ?? 0.95;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.4,
                children: [
                  _StatCard(
                    label: l10n.driverWeeklyEarnings,
                    value: Money(weekly, currency).format(),
                    icon: Icons.savings_outlined,
                    tone: AppColors.success,
                  ),
                  _StatCard(
                    label: l10n.profileRating,
                    value: (user?.ratingDriver ?? 5).toStringAsFixed(1),
                    icon: Icons.star_rounded,
                    tone: AppColors.amber,
                  ),
                  _StatCard(
                    label: l10n.driverAcceptanceRate,
                    value: '${(acceptance * 100).round()}%',
                    icon: Icons.thumb_up_outlined,
                    tone: AppColors.primary,
                  ),
                  _StatCard(
                    label: l10n.driverPunctuality,
                    value: '${(punctuality * 100).round()}%',
                    icon: Icons.schedule_rounded,
                    tone: AppColors.primary,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              KayaCard(
                child: Row(
                  children: [
                    const Icon(Icons.local_shipping_outlined,
                        color: AppColors.inkSecondary),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Text(l10n.driverTotalDeliveries,
                            style: AppTypography.bodyStrong)),
                    Text('${user?.totalDeliveries ?? 0}',
                        style: AppTypography.price),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.tone,
  });
  final String label;
  final String value;
  final IconData icon;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return KayaCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: tone),
          Text(value, style: AppTypography.price),
          Text(label, style: AppTypography.caption, maxLines: 2),
        ],
      ),
    );
  }
}
