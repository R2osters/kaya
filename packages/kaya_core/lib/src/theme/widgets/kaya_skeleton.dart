import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../app_colors.dart';
import '../app_radii.dart';

/// Base shimmering placeholder box, self-animating. Compose several inside
/// [KayaSkeletonListTile]/[KayaSkeletonCard], or use standalone.
class KayaSkeletonBox extends StatelessWidget {
  const KayaSkeletonBox({
    super.key,
    this.width,
    this.height = 14,
    this.borderRadius,
    this.shape = BoxShape.rectangle,
  });

  final double? width;
  final double height;
  final BorderRadius? borderRadius;
  final BoxShape shape;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.background,
      highlightColor: AppColors.surface,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.background,
          shape: shape,
          borderRadius: shape == BoxShape.circle
              ? null
              : (borderRadius ?? BorderRadius.circular(AppRadii.field)),
        ),
      ),
    );
  }
}

/// One skeleton row: leading avatar circle, two stacked text lines, a
/// trailing chip. Matches the shape of a typical list row across both apps
/// (order/delivery/notification/inbox rows).
class KayaSkeletonListTile extends StatelessWidget {
  const KayaSkeletonListTile({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          KayaSkeletonBox(width: 44, height: 44, shape: BoxShape.circle),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                KayaSkeletonBox(width: double.infinity, height: 14),
                SizedBox(height: 8),
                KayaSkeletonBox(width: 120, height: 12),
              ],
            ),
          ),
          SizedBox(width: 14),
          KayaSkeletonBox(width: 48, height: 20),
        ],
      ),
    );
  }
}

/// The standard stand-in for a list-shaped `loading:` branch — repeats
/// [KayaSkeletonListTile] [count] times inside a scrollable list.
class KayaSkeletonList extends StatelessWidget {
  const KayaSkeletonList({super.key, this.count = 4});
  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      itemBuilder: (_, __) => const KayaSkeletonListTile(),
    );
  }
}

/// The standard stand-in for a single detail/summary card — a title line,
/// three body lines of decreasing width, and a footer action row. Used for
/// single-item screens (delivery detail, stats, profile header) rather than
/// lists.
class KayaSkeletonCard extends StatelessWidget {
  const KayaSkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KayaSkeletonBox(width: 160, height: 18),
          SizedBox(height: 16),
          KayaSkeletonBox(width: double.infinity, height: 14),
          SizedBox(height: 8),
          KayaSkeletonBox(width: double.infinity, height: 14),
          SizedBox(height: 8),
          KayaSkeletonBox(width: 200, height: 14),
          SizedBox(height: 20),
          Row(
            children: [
              KayaSkeletonBox(width: 80, height: 32),
              SizedBox(width: 12),
              KayaSkeletonBox(width: 80, height: 32),
            ],
          ),
        ],
      ),
    );
  }
}
