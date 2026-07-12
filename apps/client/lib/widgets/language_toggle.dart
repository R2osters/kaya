import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../providers/core_providers.dart';

/// FR/EN pill toggle used on the welcome screen and profile.
class LanguageToggle extends ConsumerWidget {
  const LanguageToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);
    final isFr = locale.languageCode == 'fr';
    return GestureDetector(
      onTap: () => ref.read(localeProvider.notifier).state =
          Locale(isFr ? 'en' : 'fr'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _segment('FR', isFr),
            _segment('EN', !isFr),
          ],
        ),
      ),
    );
  }

  Widget _segment(String label, bool active) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          style: AppTypography.caption.copyWith(
            color: active ? AppColors.surface : AppColors.inkSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
}
