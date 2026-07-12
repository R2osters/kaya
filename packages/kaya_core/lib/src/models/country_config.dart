import '../constants.dart';
import 'json_utils.dart';

/// Per-country pricing & commission configuration (backend `country_configs`).
class CountryConfig {
  const CountryConfig({
    required this.countryCode,
    required this.countryName,
    required this.currency,
    required this.currencySymbol,
    required this.pricePerKm,
    required this.basePickupFee,
    required this.commissionTiers,
    required this.litigationFee,
    required this.searchRadiusKm,
    required this.withdrawalMethods,
    required this.momoProviders,
  });

  final CountryCode countryCode;
  final String countryName;
  final Currency currency;
  final String currencySymbol;
  final double pricePerKm;
  final double basePickupFee;

  /// [tier1, tier2, tier3, tier4] as fractions (0.20, 0.15, 0.12, 0.09).
  final List<double> commissionTiers;
  final double litigationFee;
  final int searchRadiusKm;
  final List<String> withdrawalMethods;
  final List<String> momoProviders;

  factory CountryConfig.fromJson(Map<String, dynamic> j) => CountryConfig(
        countryCode: CountryCodeX.fromWire(j['countryCode'] as String?),
        countryName: asString(j['countryName']),
        currency: CurrencyX.fromWire(j['currencyCode'] as String?),
        currencySymbol: asString(j['currencySymbol']),
        pricePerKm: asDouble(j['pricePerKm']),
        basePickupFee: asDouble(j['basePickupFee']),
        commissionTiers: [
          asDouble(j['commissionTier1'], 0.20),
          asDouble(j['commissionTier2'], 0.15),
          asDouble(j['commissionTier3'], 0.12),
          asDouble(j['commissionTier4'], 0.09),
        ],
        litigationFee: asDouble(j['litigationFee'], 1),
        searchRadiusKm: asInt(j['searchRadiusKm'], 5),
        withdrawalMethods: _stringList(j['withdrawalMethods']),
        momoProviders: _stringList(j['momoProviders']),
      );

  static List<String> _stringList(dynamic v) =>
      v is List ? v.map((e) => e.toString()).toList() : const [];
}
