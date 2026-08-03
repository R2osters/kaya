import '../constants.dart';
import 'json_utils.dart';

/// Result of GET /calculate-price (distance + minimum suggested price).
class PriceQuote {
  const PriceQuote({
    required this.countryCode,
    required this.distanceKm,
    required this.minPrice,
    required this.currency,
    required this.currencySymbol,
    required this.pricePerKm,
    required this.basePickupFee,
    this.durationMin,
    this.source,
  });

  final CountryCode countryCode;
  final double distanceKm;
  final double minPrice;
  final Currency currency;
  final String currencySymbol;
  final double pricePerKm;
  final double basePickupFee;
  final int? durationMin;
  final String? source;

  factory PriceQuote.fromJson(Map<String, dynamic> j) => PriceQuote(
        countryCode: CountryCodeX.fromWire(j['countryCode'] as String?),
        distanceKm: asDouble(j['distanceKm']),
        minPrice: asDouble(j['minPrice']),
        currency: CurrencyX.fromWire(j['currency'] as String?),
        currencySymbol: asString(j['currencySymbol']),
        pricePerKm: asDouble(j['pricePerKm']),
        basePickupFee: asDouble(j['basePickupFee']),
        durationMin: asIntOrNull(j['durationMin']),
        source: asStringOrNull(j['source']),
      );
}
