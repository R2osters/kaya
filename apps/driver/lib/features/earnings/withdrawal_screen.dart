import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';

class WithdrawalScreen extends ConsumerStatefulWidget {
  const WithdrawalScreen({super.key});

  @override
  ConsumerState<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends ConsumerState<WithdrawalScreen> {
  final _amount = TextEditingController();
  final _account = TextEditingController();
  WithdrawalMethod _method = WithdrawalMethod.momo;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _account.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _error = KayaL10n.of(context).invalidAmount);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(kayaApiProvider).driver.withdraw(
        amount: amount,
        method: _method,
        accountDetails: _method == WithdrawalMethod.momo
            ? {'phone': _account.text.trim(), 'provider': 'mtn'}
            : {'account': _account.text.trim()},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(KayaL10n.of(context).withdrawRequested)));
        context.pop();
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
    final balance = ref.watch(currentUserProvider)?.balance ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.driverWithdraw)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  KayaCard(
                    color: AppColors.amberTint,
                    border: false,
                    shadow: false,
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline_rounded,
                            color: AppColors.amber),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(l10n.driverWithdrawNotice,
                              style: AppTypography.caption
                                  .copyWith(color: AppColors.ink)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text('${l10n.navEarnings}: ${Money(balance, currency).format()}',
                      style: AppTypography.bodySecondary),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _MethodChip(
                          label: l10n.payMomo,
                          icon: Icons.smartphone_rounded,
                          selected: _method == WithdrawalMethod.momo,
                          onTap: () =>
                              setState(() => _method = WithdrawalMethod.momo),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _MethodChip(
                          label: l10n.driverBank,
                          icon: Icons.account_balance_outlined,
                          selected: _method == WithdrawalMethod.bank_transfer,
                          onTap: () => setState(
                              () => _method = WithdrawalMethod.bank_transfer),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  KayaTextField(
                    label: l10n.payTotal,
                    controller: _amount,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                    ],
                    prefixIcon: Icons.payments_outlined,
                  ),
                  const SizedBox(height: 16),
                  KayaTextField(
                    label: _method == WithdrawalMethod.momo
                        ? l10n.authPhone
                        : l10n.driverBank,
                    controller: _account,
                    keyboardType: _method == WithdrawalMethod.momo
                        ? TextInputType.phone
                        : TextInputType.text,
                    prefixIcon: Icons.account_circle_outlined,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
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
                label: l10n.driverWithdraw,
                loading: _loading,
                onPressed: _submit,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MethodChip extends StatelessWidget {
  const _MethodChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.field),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryTint : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.field),
          border: Border.all(
              color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Column(
          children: [
            Icon(icon,
                color: selected ? AppColors.primary : AppColors.inkSecondary),
            const SizedBox(height: 6),
            Text(label,
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w700,
                  color: selected ? AppColors.primary : AppColors.inkSecondary,
                )),
          ],
        ),
      ),
    );
  }
}
