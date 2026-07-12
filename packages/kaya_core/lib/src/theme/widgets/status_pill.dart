import 'package:flutter/material.dart';
import '../app_colors.dart';
import '../app_radii.dart';
import '../app_typography.dart';

enum StatusTone { primary, success, danger, amber, neutral }

/// Pill-shaped status badge (999px radius). Used for order/delivery states.
class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.label,
    this.tone = StatusTone.primary,
    this.icon,
    this.dense = false,
  });

  final String label;
  final StatusTone tone;
  final IconData? icon;
  final bool dense;

  (Color, Color) get _colors => switch (tone) {
        StatusTone.primary => (AppColors.primaryTint, AppColors.primary),
        StatusTone.success => (AppColors.successTint, AppColors.success),
        StatusTone.danger => (AppColors.dangerTint, AppColors.danger),
        StatusTone.amber => (AppColors.amberTint, AppColors.amber),
        StatusTone.neutral => (AppColors.background, AppColors.inkSecondary),
      };

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors;
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 10 : 12,
        vertical: dense ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: fg,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
