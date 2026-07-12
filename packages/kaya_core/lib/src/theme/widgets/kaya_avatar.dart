import 'package:flutter/material.dart';
import '../app_colors.dart';

/// Circular avatar with graceful fallback to initials when no photo is set.
class KayaAvatar extends StatelessWidget {
  const KayaAvatar({
    super.key,
    this.photoUrl,
    this.name,
    this.radius = 24,
    this.ring = false,
  });

  final String? photoUrl;
  final String? name;
  final double radius;
  final bool ring;

  String get _initials {
    final n = (name ?? '').trim();
    if (n.isEmpty) return '';
    final parts = n.split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first)
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final avatar = CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.background,
      foregroundImage: (photoUrl != null && photoUrl!.isNotEmpty)
          ? NetworkImage(photoUrl!)
          : null,
      child: (photoUrl == null || photoUrl!.isEmpty)
          ? (_initials.isEmpty
              ? Icon(Icons.person_outline_rounded,
                  color: AppColors.inkTertiary, size: radius)
              : Text(
                  _initials,
                  style: TextStyle(
                    color: AppColors.inkSecondary,
                    fontWeight: FontWeight.w700,
                    fontSize: radius * 0.7,
                  ),
                ))
          : null,
    );
    if (!ring) return avatar;
    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.primary, width: 2),
      ),
      child: avatar,
    );
  }
}
