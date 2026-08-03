import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  group('Degressive commission tiers', () {
    test('tier is set by the day delivery number', () {
      // #1-6 -> 20%
      expect(commissionRateForDeliveryNumber(1), 0.20);
      expect(commissionRateForDeliveryNumber(6), 0.20);
      // #7-10 -> 15%
      expect(commissionRateForDeliveryNumber(7), 0.15);
      expect(commissionRateForDeliveryNumber(10), 0.15);
      // #11-14 -> 12%
      expect(commissionRateForDeliveryNumber(11), 0.12);
      expect(commissionRateForDeliveryNumber(14), 0.12);
      // #15+ -> 9%
      expect(commissionRateForDeliveryNumber(15), 0.09);
      expect(commissionRateForDeliveryNumber(40), 0.09);
    });
  });

  group('CommissionPreview (driver propose-price net)', () {
    test('first delivery of the day: 20% + litigation fee', () {
      final p = CommissionPreview(
        grossPrice: 50,
        completedToday: 0,
        litigationFee: 1,
      );
      expect(p.deliveryNumber, 1);
      expect(p.ratePercent, 20);
      expect(p.commission, 10.00);
      expect(p.net, 39.00); // 50 - 10 - 1
    });

    test('seventh delivery drops the driver into the 15% tier', () {
      final p = CommissionPreview(
        grossPrice: 100,
        completedToday: 6, // next one is #7
        litigationFee: 1,
      );
      expect(p.deliveryNumber, 7);
      expect(p.ratePercent, 15);
      expect(p.commission, 15.00);
      expect(p.net, 84.00);
    });

    test('XOF litigation fee (100) is subtracted correctly', () {
      final p = CommissionPreview(
        grossPrice: 2000,
        completedToday: 0,
        litigationFee: 100,
      );
      expect(p.commission, 400.00); // 20%
      expect(p.net, 1500.00); // 2000 - 400 - 100
    });
  });
}
