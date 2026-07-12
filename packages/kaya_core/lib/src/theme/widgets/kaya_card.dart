import 'package:flutter/material.dart';
import '../app_colors.dart';
import '../app_radii.dart';
import '../app_shadows.dart';

/// White surface card with soft shadow and 18–20px radius.
class KayaCard extends StatelessWidget {
  const KayaCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.radius = AppRadii.card,
    this.border = true,
    this.color = AppColors.surface,
    this.shadow = true,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final double radius;
  final bool border;
  final Color color;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
        border: border ? Border.all(color: AppColors.borderSoft) : null,
        boxShadow: shadow ? AppShadows.card : null,
      ),
      child: child,
    );

    if (onTap == null) return content;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(radius),
        child: content,
      ),
    );
  }
}
