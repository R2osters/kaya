import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';

/// Loads the order so we know the minimum price to bid against.
final _orderProvider =
    FutureProvider.autoDispose.family<Order, String>((ref, id) async {
  return ref.read(kayaApiProvider).orders.byId(id);
});

class ProposePriceScreen extends ConsumerStatefulWidget {
  const ProposePriceScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<ProposePriceScreen> createState() =>
      _ProposePriceScreenState();
}

class _ProposePriceScreenState extends ConsumerState<ProposePriceScreen> {
  double? _price;
  bool _submitting = false;
  String? _error;

  /// Litigation fee is 1 GHS in Ghana and 100 XOF elsewhere (country config).
  double _litigationFee(Currency c) => c == Currency.XOF ? 100 : 1;

  Future<void> _submit(double min) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(kayaApiProvider).offers.create(widget.orderId, _price ?? min);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(KayaL10n.of(context).offerSent)));
        context.go('/home');
      }
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final user = ref.watch(currentUserProvider);
    final currency = user?.currency ?? Currency.GHS;
    final completedToday = user?.dailyDeliveries ?? 0;
    final orderAsync = ref.watch(_orderProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.driverProposePrice)),
      body: orderAsync.when(
        loading: () => const KayaSkeletonCard(),
        error: (_, __) => Center(child: Text(l10n.commonError)),
        data: (order) {
          final double min = order.minPriceSuggested ?? 0;
          final double price = _price ?? min;
          final preview = CommissionPreview(
            grossPrice: price,
            completedToday: completedToday,
            litigationFee: _litigationFee(currency),
          );
          final step = currency == Currency.XOF ? 50.0 : 1.0;

          return SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      KayaCard(
                        color: AppColors.background,
                        border: false,
                        shadow: false,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('${l10n.driverMinimum} · ',
                                style: AppTypography.bodySecondary),
                            Text(Money(min, currency).format(),
                                style: AppTypography.bodyStrong),
                          ],
                        ),
                      ),
                      const SizedBox(height: 28),
                      Center(
                        child: Text(Money(price, currency).format(),
                            style: AppTypography.priceLarge
                                .copyWith(fontSize: 40)),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Text(l10n.driverProposePrice,
                            style: AppTypography.caption),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _stepButton(Icons.remove_rounded, () {
                            final next = (price - step).clamp(min, 1e9);
                            setState(() => _price = next.toDouble());
                          }),
                          const SizedBox(width: 32),
                          _stepButton(Icons.add_rounded, () {
                            setState(() => _price = price + step);
                          }),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Builder(builder: (_) {
                        final double sliderMax = min <= 0 ? 100.0 : min * 3;
                        return Slider(
                          value: price.clamp(min, sliderMax).toDouble(),
                          min: min,
                          max: sliderMax,
                          activeColor: AppColors.primary,
                          onChanged: (v) => setState(() => _price = v),
                        );
                      }),
                      const SizedBox(height: 20),
                      // Live net-after-commission preview.
                      KayaCard(
                        child: Column(
                          children: [
                            _row(
                                '${l10n.driverCommission} (${preview.ratePercent}%)',
                                '- ${Money(preview.commission, currency).format()}'),
                            const Divider(height: 22),
                            _row(l10n.payLitigationFee,
                                '- ${Money(preview.litigationFee, currency).format()}'),
                            const Divider(height: 22),
                            _row(l10n.driverNetAfterCommission,
                                Money(preview.net, currency).format(),
                                strong: true),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.driverTierLine(
                            '${preview.deliveryNumber}', '${preview.ratePercent}'),
                        style: AppTypography.caption,
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!,
                            style: AppTypography.caption
                                .copyWith(color: AppColors.danger)),
                      ],
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: KayaButton(
                    label: l10n.actionConfirm,
                    loading: _submitting,
                    onPressed: () => _submit(min),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _stepButton(IconData icon, VoidCallback onTap) => Material(
        color: AppColors.primaryTint,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Icon(icon, color: AppColors.primary, size: 26),
          ),
        ),
      );

  Widget _row(String label, String value, {bool strong = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: strong ? AppTypography.cardTitle : AppTypography.bodySecondary),
        Text(value,
            style: strong
                ? AppTypography.price.copyWith(color: AppColors.success)
                : AppTypography.bodyStrong),
      ],
    );
  }
}
