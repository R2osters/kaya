import 'package:flutter/material.dart';
import '../app_colors.dart';

/// Amber star rating. Read-only by default; pass [onRate] for interactive input.
class RatingStars extends StatelessWidget {
  const RatingStars({
    super.key,
    required this.value,
    this.size = 18,
    this.onRate,
    this.count = 5,
  });

  final double value;
  final double size;
  final ValueChanged<int>? onRate;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (i) {
        final filled = i < value.round();
        final half = !filled && (i < value) && (value - i) >= 0.25;
        final star = Icon(
          half
              ? Icons.star_half_rounded
              : (filled ? Icons.star_rounded : Icons.star_outline_rounded),
          size: size,
          color: (filled || half) ? AppColors.amber : AppColors.inkTertiary,
        );
        if (onRate == null) return star;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onRate!(i + 1),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: star,
          ),
        );
      }),
    );
  }
}
