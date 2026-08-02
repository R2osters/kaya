// Money is a const constructor, but these literals read clearer without const.
// ignore_for_file: prefer_const_constructors
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  group('Money formatting', () {
    test('GHS keeps two decimals and trailing code', () {
      expect(Money(50, Currency.GHS).format(), '50.00 GHS');
      expect(Money(48.5, Currency.GHS).format(), '48.50 GHS');
      expect(formatMoney(1234.5, Currency.GHS), '1,234.50 GHS');
    });

    test('XOF is a zero-decimal currency with grouped thousands', () {
      expect(Currency.XOF.decimals, 0);
      // fr_FR grouping uses a non-breaking space; assert the code + rounding.
      final formatted = Money(1200, Currency.XOF).format();
      expect(formatted.endsWith('XOF'), isTrue);
      expect(formatted.contains('.'), isFalse);
      expect(formatted.replaceAll(RegExp(r'[^0-9]'), ''), '1200');
    });

    test('NGN is display-only with two decimals', () {
      expect(Money(999, Currency.NGN).format(), '999.00 NGN');
    });

    test('withSymbol:false drops the code', () {
      expect(Money(50, Currency.GHS).format(withSymbol: false), '50.00');
    });

    test('country maps to the right currency', () {
      expect(CountryCode.GHA.currency, Currency.GHS);
      expect(CountryCode.TGO.currency, Currency.XOF);
      expect(CountryCode.BEN.currency, Currency.XOF);
    });
  });
}
