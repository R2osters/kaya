import 'package:flutter/material.dart';

/// "Accra Minimalist Delivery" palette. Exact values from the design reference.
/// Do not introduce new color literals in the apps — extend this class instead.
abstract final class AppColors {
  // Brand / actions
  static const Color primary = Color(0xFF1466FF); // electric blue
  static const Color success = Color(0xFF12A150); // green (MoMo, delivered)
  static const Color danger = Color(0xFFE5484D); // cancellations, disputes
  static const Color amber = Color(0xFFF5A623); // stars / ratings

  // Text / ink
  static const Color ink = Color(0xFF0B1220); // primary text
  static const Color inkSecondary = Color(0xFF5B6472);
  static const Color inkTertiary = Color(0xFF8A94A6);

  // Surfaces
  static const Color surface = Color(0xFFFFFFFF);
  static const Color background = Color(0xFFF4F6F9);
  static const Color border = Color(0xFFE7EAF0);
  static const Color borderSoft = Color(0xFFEBEEF3);

  // Tints (soft chip / badge backgrounds — derived, light-only)
  static const Color primaryTint = Color(0xFFEAF1FF);
  static const Color successTint = Color(0xFFE6F5EC);
  static const Color dangerTint = Color(0xFFFCEBEC);
  static const Color amberTint = Color(0xFFFEF3E0);

  // Map markers
  static const Color markerPickup = success; // green = pickup
  static const Color markerDropoff = primary; // blue = drop-off

  const AppColors._();
}
