import 'package:flutter/material.dart';

/// Light, soft shadows — the design system favors subtle depth over heavy drops.
abstract final class AppShadows {
  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x0F0B1220), // ~6% ink
      blurRadius: 18,
      offset: Offset(0, 6),
      spreadRadius: -6,
    ),
  ];

  static const List<BoxShadow> soft = [
    BoxShadow(
      color: Color(0x0A0B1220), // ~4% ink
      blurRadius: 12,
      offset: Offset(0, 4),
      spreadRadius: -4,
    ),
  ];

  static const List<BoxShadow> sheet = [
    BoxShadow(
      color: Color(0x1A0B1220), // ~10% ink
      blurRadius: 28,
      offset: Offset(0, -8),
      spreadRadius: -8,
    ),
  ];

  const AppShadows._();
}
