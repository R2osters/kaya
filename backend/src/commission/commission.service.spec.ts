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
  };

  const xof = { ...ghs, litigationFee: new Prisma.Decimal('100') };

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

  it('rounds commission to 2 decimals (half up)', () => {
    // 25.55 * 0.15 = 3.8325 -> 3.83
    const b = service.calculate(new Prisma.Decimal('25.55'), 7, ghs);
    expect(b.commission.toFixed(2)).toBe('3.83');
  });
});
