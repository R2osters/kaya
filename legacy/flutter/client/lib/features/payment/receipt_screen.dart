import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

class ReceiptScreen extends ConsumerWidget {
  const ReceiptScreen({super.key, required this.delivery});
  final Delivery delivery;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final currency = ref.watch(currentUserProvider)?.currency ?? Currency.GHS;
    final base = delivery.basePrice ?? 0;
    final fee = delivery.litigationFee;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.payReceipt)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const SizedBox(height: 24),
                  Center(
                    child: Container(
                      width: 88,
                      height: 88,
                      decoration: const BoxDecoration(
                        color: AppColors.successTint,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check_rounded,
                          size: 44, color: AppColors.success),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Center(
                      child: Text(l10n.payEscrowNote,
                          textAlign: TextAlign.center,
                          style: AppTypography.bodySecondary)),
                  const SizedBox(height: 28),
                  KayaCard(
                    child: Column(
                      children: [
                        _row(l10n.orderNumber,
                            '#${delivery.orderId.substring(0, 8).toUpperCase()}'),
                        const Divider(height: 24),
                        _row(l10n.payTotal, Money(base, currency).format()),
                        const Divider(height: 24),
                        _row(l10n.payLitigationFee, Money(fee, currency).format()),
                        const Divider(height: 24),
                        _row(l10n.payTotal, Money(base + fee, currency).format(),
                            strong: true),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: KayaButton(
                label: l10n.trackTitle,
                icon: Icons.map_outlined,
                onPressed: () =>
                    context.pushReplacement('/tracking/${delivery.id}'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value, {bool strong = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.bodySecondary),
        Text(value,
            style: strong ? AppTypography.price : AppTypography.bodyStrong),
      ],
    );
  }
}
