import 'package:flutter/material.dart';
import 'package:kaya_core/kaya_core.dart';

/// Horizontal 4-step delivery timeline: en route -> picked up -> on the way ->
/// delivered. [currentStep] is 0..3.
class DeliveryTimeline extends StatelessWidget {
  const DeliveryTimeline({super.key, required this.currentStep});
  final int currentStep;

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final labels = [
      l10n.trackEnRoute,
      l10n.trackPickedUp,
      l10n.trackInTransit,
      l10n.trackDelivered,
    ];

    return Column(
      children: [
        Row(
          children: List.generate(4 * 2 - 1, (i) {
            if (i.isOdd) {
              final segment = i ~/ 2;
              final done = segment < currentStep;
              return Expanded(
                child: Container(
                  height: 3,
                  color: done ? AppColors.primary : AppColors.border,
                ),
              );
            }
            final step = i ~/ 2;
            final done = step < currentStep;
            final active = step == currentStep;
            return _dot(done: done, active: active);
          }),
        ),
        const SizedBox(height: 8),
        Row(
          children: List.generate(4, (i) {
            final active = i == currentStep;
            return Expanded(
              child: Text(
                labels[i],
                textAlign: i == 0
                    ? TextAlign.start
                    : (i == 3 ? TextAlign.end : TextAlign.center),
                style: AppTypography.caption.copyWith(
                  color: active ? AppColors.primary : AppColors.inkSecondary,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _dot({required bool done, required bool active}) {
    if (done) {
      return const CircleAvatar(
        radius: 13,
        backgroundColor: AppColors.primary,
        child: Icon(Icons.check_rounded, size: 15, color: AppColors.surface),
      );
    }
    if (active) {
      return Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.primary, width: 2.5),
        ),
        child: const Center(
          child: CircleAvatar(radius: 6, backgroundColor: AppColors.primary),
        ),
      );
    }
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.border, width: 2.5),
      ),
    );
  }
}
