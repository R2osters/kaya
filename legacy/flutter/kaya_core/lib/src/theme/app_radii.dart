/// Corner radii from the design system.
/// buttons/fields 14–16, cards 18–20, bottom sheets 28, pills 999.
abstract final class AppRadii {
  static const double field = 14;
  static const double button = 16;
  static const double card = 20;
  static const double cardTight = 18;
  static const double sheet = 28;
  static const double pill = 999;

  const AppRadii._();
}

/// Spacing scale (4pt grid) used across both apps.
abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  /// Minimum touch target per the design system.
  static const double minTouch = 44;

  const AppSpacing._();
}
