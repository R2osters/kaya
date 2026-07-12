// CountryCode / Currency values use the exact wire spellings (GHA, GHS, …) that
// the backend sends and `.name` is compared against — hence the SCREAMING_CASE.
// ignore_for_file: constant_identifier_names
import 'package:intl/intl.dart';

/// Single source of truth for the app name. The final brand is not chosen yet;
/// "Kaya" is the working name. Never hardcode a brand string in the UI —
/// read [kAppName] instead.
const String kAppName = 'Kaya';

/// Country codes supported in v1 (mirrors backend CountryCode enum).
enum CountryCode { GHA, TGO, BEN }

extension CountryCodeX on CountryCode {
  String get wire => name; // GHA / TGO / BEN
  String get flag => switch (this) {
        CountryCode.GHA => '🇬🇭',
        CountryCode.TGO => '🇹🇬',
        CountryCode.BEN => '🇧🇯',
      };
  String get displayName => switch (this) {
        CountryCode.GHA => 'Ghana',
        CountryCode.TGO => 'Togo',
        CountryCode.BEN => 'Bénin',
      };
  Currency get currency =>
      this == CountryCode.GHA ? Currency.GHS : Currency.XOF;

  static CountryCode fromWire(String? v) => CountryCode.values.firstWhere(
        (c) => c.name == v,
        orElse: () => CountryCode.GHA,
      );
}

/// Currencies in v1. NGN is display-only (parking lot; shown on profile).
enum Currency { GHS, XOF, NGN }

extension CurrencyX on Currency {
  String get symbol => switch (this) {
        Currency.GHS => 'GHS',
        Currency.XOF => 'XOF',
        Currency.NGN => 'NGN',
      };

  /// XOF is a zero-decimal currency; GHS/NGN use 2 decimals.
  int get decimals => this == Currency.XOF ? 0 : 2;

  static Currency fromWire(String? v) => Currency.values.firstWhere(
        (c) => c.name == v,
        orElse: () => Currency.GHS,
      );
}

/// Formats money in the design's "amount + code" style, e.g. "50 GHS", "1 200 XOF".
/// Symbol trails the amount to match the reference screens.
class Money {
  const Money(this.amount, this.currency);

  final double amount;
  final Currency currency;

  String format({bool withSymbol = true}) {
    final fmt = NumberFormat.currency(
      locale: currency == Currency.XOF ? 'fr_FR' : 'en_US',
      symbol: '',
      decimalDigits: currency.decimals,
    );
    final number = fmt.format(amount).trim();
    return withSymbol ? '$number ${currency.symbol}' : number;
  }

  @override
  String toString() => format();
}

/// Convenience: format a raw double for a currency without constructing [Money].
String formatMoney(num amount, Currency currency) =>
    Money(amount.toDouble(), currency).format();

/// Degressive commission tiers by the day's delivery number (1-based).
/// #1–6 → 20%, #7–10 → 15%, #11–14 → 12%, #15+ → 9%. Mirrors the blueprint.
double commissionRateForDeliveryNumber(int deliveryNumber) {
  if (deliveryNumber >= 15) return 0.09;
  if (deliveryNumber >= 11) return 0.12;
  if (deliveryNumber >= 7) return 0.15;
  return 0.20;
}

/// Net earnings preview for a driver's proposed price given today's completed
/// count. The *next* delivery is number (completedToday + 1).
class CommissionPreview {
  CommissionPreview({
    required this.grossPrice,
    required this.completedToday,
    required this.litigationFee,
  })  : deliveryNumber = completedToday + 1,
        rate = commissionRateForDeliveryNumber(completedToday + 1);

  final double grossPrice;
  final int completedToday;
  final double litigationFee;
  final int deliveryNumber;
  final double rate;

  double get commission =>
      double.parse((grossPrice * rate).toStringAsFixed(2));
  double get net => double.parse(
      (grossPrice - commission - litigationFee).toStringAsFixed(2));
  int get ratePercent => (rate * 100).round();
}
