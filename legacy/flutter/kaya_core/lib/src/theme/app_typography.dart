import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Inter type scale (400/500/600/700/800). Screen titles 26–29px,
/// prices bold 18–22px, overlines 12px uppercase letterspaced.
abstract final class AppTypography {
  static TextStyle _inter({
    required double size,
    required FontWeight weight,
    Color color = AppColors.ink,
    double? height,
    double? letterSpacing,
  }) {
    return GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  // Screen / section titles
  static TextStyle get screenTitle =>
      _inter(size: 28, weight: FontWeight.w800, height: 1.15);
  static TextStyle get sectionTitle =>
      _inter(size: 22, weight: FontWeight.w700, height: 1.2);
  static TextStyle get cardTitle =>
      _inter(size: 17, weight: FontWeight.w700, height: 1.25);

  // Body
  static TextStyle get body =>
      _inter(size: 15, weight: FontWeight.w400, height: 1.4, color: AppColors.ink);
  static TextStyle get bodyStrong =>
      _inter(size: 15, weight: FontWeight.w600, height: 1.4);
  static TextStyle get bodySecondary => _inter(
        size: 15,
        weight: FontWeight.w400,
        height: 1.4,
        color: AppColors.inkSecondary,
      );
  static TextStyle get caption => _inter(
        size: 13,
        weight: FontWeight.w400,
        color: AppColors.inkSecondary,
      );

  // Prices — bold 18–22
  static TextStyle get price =>
      _inter(size: 20, weight: FontWeight.w800, height: 1.1);
  static TextStyle get priceLarge =>
      _inter(size: 26, weight: FontWeight.w800, height: 1.1);

  // Overline — 12px uppercase letterspaced
  static TextStyle get overline => _inter(
        size: 12,
        weight: FontWeight.w700,
        color: AppColors.inkTertiary,
        letterSpacing: 1.1,
      );

  // Button label
  static TextStyle get button =>
      _inter(size: 16, weight: FontWeight.w700, color: AppColors.surface);

  const AppTypography._();
}
