import { Prisma } from '@prisma/client';
import { CommissionService } from './commission.service';

describe('CommissionService (degressive commission)', () => {
  const service = new CommissionService();

  const ghs = {
    commissionTier1: new Prisma.Decimal('0.20'),
    commissionTier2: new Prisma.Decimal('0.15'),
    commissionTier3: new Prisma.Decimal('0.12'),
    commissionTier4: new Prisma.Decimal('0.09'),
    litigationFee: new Prisma.Decimal('1.00'),
    currencyCode: 'GHS' as const,
  };

  const xof = {
    ...ghs,
    litigationFee: new Prisma.Decimal('100'),
    currencyCode: 'XOF' as const,
  };

  const base = new Prisma.Decimal('100.00');

  it.each([
    [1, 0.2],
    [6, 0.2],
    [7, 0.15],
    [10, 0.15],
    [11, 0.12],
    [14, 0.12],
    [15, 0.09],
    [40, 0.09],
  ])('delivery #%i of the day uses rate %s', (n, expectedRate) => {
    const b = service.calculate(base, n, ghs);
    expect(Number(b.rate)).toBe(expectedRate);
  });

  it('computes commission and net earnings for the first delivery (GHS)', () => {
    const b = service.calculate(base, 1, ghs);
    // 100 * 0.20 = 20 commission; net = 100 - 20 - 1 = 79
    expect(b.commission.toFixed(2)).toBe('20.00');
    expect(b.litigationFee.toFixed(2)).toBe('1.00');
    expect(b.netEarnings.toFixed(2)).toBe('79.00');
  });

  it('applies the reduced tier and XOF litigation fee on the 7th delivery', () => {
    const b = service.calculate(new Prisma.Decimal('900'), 7, xof);
    // 900 * 0.15 = 135 commission; net = 900 - 135 - 100 = 665
    expect(b.commission.toFixed(2)).toBe('135.00');
    expect(b.litigationFee.toFixed(2)).toBe('100.00');
    expect(b.netEarnings.toFixed(2)).toBe('665.00');
  });

  it('rounds commission to 2 decimals in a 2-decimal currency (half up)', () => {
    // 25.55 * 0.15 = 3.8325 -> 3.83
    const b = service.calculate(new Prisma.Decimal('25.55'), 7, ghs);
    expect(b.commission.toFixed(2)).toBe('3.83');
  });

  describe('zero-decimal currencies (XOF)', () => {
    it('rounds commission to whole francs, since no coin below one exists', () => {
      // 2555 * 0.15 = 383.25 -> 383, not 383.25
      const b = service.calculate(new Prisma.Decimal('2555'), 7, xof);

      expect(b.commission.toString()).toBe('383');
      expect(b.commission.decimalPlaces()).toBe(0);
    });

    it('rounds half away from zero, matching the client-side rule', () => {
      // 3670 * 0.15 = 550.5 -> 551
      const b = service.calculate(new Prisma.Decimal('3670'), 7, xof);

      expect(b.commission.toString()).toBe('551');
    });

    it('keeps the breakdown summing to the base price', () => {
      // The defect this fixes. With every part rounded to 2dp and then shown
      // at 0dp, two halves in one breakdown could each round up and the three
      // numbers on the driver's earnings screen stopped adding up -- with the
      // difference landing in an append-only ledger.
      const basePrice = new Prisma.Decimal('2555');
      const b = service.calculate(basePrice, 7, xof);

      expect(b.commission.plus(b.litigationFee).plus(b.netEarnings).toString()).toBe(
        basePrice.toString(),
      );
    });

    it('keeps the breakdown summing across a range of awkward amounts', () => {
      for (const amount of ['1', '7', '99', '333', '1250', '2555', '3670', '9999']) {
        const basePrice = new Prisma.Decimal(amount);
        const b = service.calculate(basePrice, 7, xof);

        expect(b.commission.plus(b.litigationFee).plus(b.netEarnings).toString()).toBe(
          basePrice.toString(),
        );
        expect(b.commission.decimalPlaces()).toBe(0);
        expect(b.netEarnings.decimalPlaces()).toBe(0);
      }
    });

    it('leaves no fractional part on any amount in the breakdown', () => {
      const b = service.calculate(new Prisma.Decimal('1250'), 3, xof);

      expect(b.commission.decimalPlaces()).toBe(0);
      expect(b.litigationFee.decimalPlaces()).toBe(0);
      expect(b.netEarnings.decimalPlaces()).toBe(0);
    });
  });

  it('still sums exactly in a 2-decimal currency', () => {
    const basePrice = new Prisma.Decimal('25.55');
    const b = service.calculate(basePrice, 7, ghs);

    expect(b.commission.plus(b.litigationFee).plus(b.netEarnings).toFixed(2)).toBe(
      basePrice.toFixed(2),
    );
  });
});
