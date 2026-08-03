import 'package:flutter/material.dart';
import '../app_colors.dart';
import '../app_radii.dart';
import '../app_typography.dart';

enum KayaButtonVariant { primary, secondary, danger }

/// Primary CTA button. Always >= 44px tall (design system touch target).
class KayaButton extends StatelessWidget {
  const KayaButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = KayaButtonVariant.primary,
    this.icon,
    this.loading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final KayaButtonVariant variant;
  final IconData? icon;
  final bool loading;
  final bool expand;

  bool get _isFilled => variant != KayaButtonVariant.secondary;

  Color get _bg => switch (variant) {
        KayaButtonVariant.primary => AppColors.primary,
        KayaButtonVariant.danger => AppColors.danger,
        KayaButtonVariant.secondary => AppColors.surface,
      };

  Color get _fg =>
      _isFilled ? AppColors.surface : AppColors.ink;

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null || loading;
    final child = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2.4, color: _fg),
          )
        else ...[
          if (icon != null) ...[
            Icon(icon, size: 20, color: _fg),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.button.copyWith(color: _fg),
            ),
          ),
        ],
      ],
    );

    return Opacity(
      opacity: disabled && !loading ? 0.5 : 1,
      child: Material(
        color: _bg,
        borderRadius: BorderRadius.circular(AppRadii.button),
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(AppRadii.button),
          child: Container(
            constraints: const BoxConstraints(minHeight: AppSpacing.minTouch),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.button),
              border: _isFilled
                  ? null
                  : Border.all(color: AppColors.border, width: 1.4),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
