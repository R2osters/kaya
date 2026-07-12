import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';
import 'app_radii.dart';
import 'app_typography.dart';

/// Builds the shared "Accra Minimalist Delivery" [ThemeData].
/// Both apps must use this — no per-app ThemeData duplication.
abstract final class AppTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary,
        onPrimary: AppColors.surface,
        secondary: AppColors.primary,
        onSecondary: AppColors.surface,
        surface: AppColors.surface,
        onSurface: AppColors.ink,
        error: AppColors.danger,
        onError: AppColors.surface,
        outline: AppColors.border,
      ),
    );

    return base.copyWith(
      textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
        bodyColor: AppColors.ink,
        displayColor: AppColors.ink,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: AppColors.ink),
        titleTextStyle: AppTypography.sectionTitle,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.borderSoft,
        thickness: 1,
        space: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: AppTypography.bodySecondary,
        border: _fieldBorder(AppColors.border),
        enabledBorder: _fieldBorder(AppColors.border),
        focusedBorder: _fieldBorder(AppColors.primary, width: 1.6),
        errorBorder: _fieldBorder(AppColors.danger),
        focusedErrorBorder: _fieldBorder(AppColors.danger, width: 1.6),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.inkTertiary,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        showUnselectedLabels: true,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AppColors.primaryTint,
        side: BorderSide.none,
        shape: const StadiumBorder(),
      ),
      splashFactory: InkRipple.splashFactory,
    );
  }

  static OutlineInputBorder _fieldBorder(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadii.field),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  const AppTheme._();
}
