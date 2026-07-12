import 'package:flutter/material.dart';
import '../app_colors.dart';
import '../app_typography.dart';
import 'kaya_button.dart';

/// Centered empty/placeholder state with optional action.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.background,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: AppColors.inkTertiary),
            ),
            const SizedBox(height: 16),
            Text(title, style: AppTypography.cardTitle, textAlign: TextAlign.center),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                style: AppTypography.bodySecondary,
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              KayaButton(
                label: actionLabel!,
                onPressed: onAction,
                expand: false,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
