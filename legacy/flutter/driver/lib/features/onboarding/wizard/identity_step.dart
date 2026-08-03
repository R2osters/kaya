import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'register_wizard_controller.dart';

class IdentityStep extends ConsumerStatefulWidget {
  const IdentityStep({super.key, required this.onNext, this.initialFullName});
  final VoidCallback onNext;

  /// Full name known synchronously at construction time (e.g. from a social
  /// sign-up), used to seed the name field immediately. Bypasses
  /// `registerWizardProvider` for this initial value so the field is
  /// correct on the very first build, regardless of whether the provider's
  /// own async prefill (see `RegisterWizardScreen.initState`) has run yet.
  final String? initialFullName;

  @override
  ConsumerState<IdentityStep> createState() => _IdentityStepState();
}

class _IdentityStepState extends ConsumerState<IdentityStep> {
  late final _name = TextEditingController(
    text: widget.initialFullName ?? ref.read(registerWizardProvider).fullName);
  CountryCode _country = CountryCode.GHA;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        KayaTextField(
          label: l10n.authFullName,
          controller: _name,
          prefixIcon: Icons.person_outline_rounded,
        ),
        const SizedBox(height: 16),
        Text(l10n.authCountry, style: AppTypography.bodyStrong),
        const SizedBox(height: 8),
        CountryPicker(value: _country, onChanged: (c) => setState(() => _country = c)),
        const SizedBox(height: 28),
        KayaButton(
          label: l10n.actionContinue,
          onPressed: () {
            ref.read(registerWizardProvider.notifier).updateIdentity(
              fullName: _name.text.trim(), country: _country);
            widget.onNext();
          },
        ),
      ],
    );
  }
}

/// Extracted from the old RegisterScreen's private `_CountryPicker` (was
/// duplicated per-app already; now shared by all wizard steps that need it).
class CountryPicker extends StatelessWidget {
  const CountryPicker({super.key, required this.value, required this.onChanged});
  final CountryCode value;
  final ValueChanged<CountryCode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: CountryCode.values.map((c) {
        final active = c == value;
        return Expanded(
          child: GestureDetector(
            onTap: () => onChanged(c),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: active ? AppColors.primaryTint : AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.field),
                border: Border.all(color: active ? AppColors.primary : AppColors.border),
              ),
              child: Column(
                children: [
                  Text(c.flag, style: const TextStyle(fontSize: 20)),
                  const SizedBox(height: 4),
                  Text(c.displayName,
                      style: AppTypography.caption.copyWith(
                        color: active ? AppColors.primary : AppColors.inkSecondary,
                        fontWeight: FontWeight.w700,
                      )),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
