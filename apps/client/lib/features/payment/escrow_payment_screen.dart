import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import 'payment_webview_screen.dart';

enum _PayMethod { momo, card }

class EscrowPaymentScreen extends ConsumerStatefulWidget {
  const EscrowPaymentScreen({super.key, required this.delivery});
  final Delivery delivery;

  @override
  ConsumerState<EscrowPaymentScreen> createState() =>
      _EscrowPaymentScreenState();
}

class _EscrowPaymentScreenState extends ConsumerState<EscrowPaymentScreen> {
  _PayMethod _method = _PayMethod.momo;
  bool _loading = false;
  String? _error;

  Future<void> _pay() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res =
          await ref.read(kayaApiProvider).payments.initialize(widget.delivery.id);
      final url = (res['checkoutUrl'] ?? res['paymentUrl'] ?? res['authorization_url'])
          as String?;
      final reference = (res['reference'] ?? res['ref']) as String?;
      if (url == null || reference == null) {
        // Mock/sandbox gateway may auto-settle; go straight to receipt.
        if (mounted) context.pushReplacement('/receipt', extra: widget.delivery);
        return;
      }
      if (!mounted) return;
      final ok = await context.push<bool>('/payment-webview',
          extra: PaymentWebviewArgs(
            url: url,
            reference: reference,
            deliveryId: widget.delivery.id,
          ));
      if (ok == true && mounted) {
        context.pushReplacement('/receipt', extra: widget.delivery);
      }
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final currency = ref.watch(currentUserProvider)?.currency ?? Currency.GHS;
    final base = widget.delivery.basePrice ?? 0;
    final fee = widget.delivery.litigationFee;
    final total = base + fee;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.payTitle)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  KayaCard(
                    color: AppColors.successTint,
                    border: false,
                    shadow: false,
                    child: Row(
                      children: [
                        const Icon(Icons.lock_rounded, color: AppColors.success),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(l10n.payEscrowNote,
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.success)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(l10n.payMomo.toUpperCase(), style: AppTypography.overline),
                  const SizedBox(height: 10),
                  _MethodTile(
                    icon: Icons.smartphone_rounded,
                    label: l10n.payMomo,
                    subtitle: 'MTN · Vodafone · AirtelTigo',
                    selected: _method == _PayMethod.momo,
                    onTap: () => setState(() => _method = _PayMethod.momo),
                  ),
                  const SizedBox(height: 10),
                  _MethodTile(
                    icon: Icons.credit_card_rounded,
                    label: l10n.payCard,
                    subtitle: 'Visa · Mastercard',
                    selected: _method == _PayMethod.card,
                    onTap: () => setState(() => _method = _PayMethod.card),
                  ),
                  const SizedBox(height: 24),
                  KayaCard(
                    child: Column(
                      children: [
                        _row(l10n.payTotal, Money(base, currency).format(),
                            strong: false),
                        const Divider(height: 24),
                        _row(l10n.payLitigationFee,
                            Money(fee, currency).format(),
                            strong: false),
                        const Divider(height: 24),
                        _row(l10n.payTotal, Money(total, currency).format(),
                            strong: true),
                      ],
                    ),
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
                label: '${l10n.payPay} · ${Money(total, currency).format()}',
                loading: _loading,
                onPressed: _pay,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value, {required bool strong}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: strong ? AppTypography.cardTitle : AppTypography.bodySecondary),
        Text(value,
            style: strong ? AppTypography.price : AppTypography.bodyStrong),
      ],
    );
  }
}

class _MethodTile extends StatelessWidget {
  const _MethodTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return KayaCard(
      onTap: onTap,
      border: true,
      shadow: false,
      color: selected ? AppColors.primaryTint : AppColors.surface,
      child: Row(
        children: [
          Icon(icon, color: selected ? AppColors.primary : AppColors.inkSecondary),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppTypography.bodyStrong),
                Text(subtitle, style: AppTypography.caption),
              ],
            ),
          ),
          Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_off_rounded,
            color: selected ? AppColors.primary : AppColors.inkTertiary,
          ),
        ],
      ),
    );
  }
}
