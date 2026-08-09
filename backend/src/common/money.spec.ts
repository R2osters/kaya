import { Prisma } from '@prisma/client';
import { currencyDecimals, roundMoney } from './money';

const d = (v: string) => new Prisma.Decimal(v);

describe('currencyDecimals', () => {
  it('gives XOF no decimals -- there is no coin below one franc', () => {
    expect(currencyDecimals('XOF')).toBe(0);
  });

  it('gives GHS two, for pesewas', () => {
    expect(currencyDecimals('GHS')).toBe(2);
  });

  it('falls back to two for an unknown currency', () => {
    expect(currencyDecimals('ZZZ')).toBe(2);
  });

  it('agrees with @kaya/core, which the apps render previews from', () => {
    // packages/kaya-core/src/money/currency.ts currencyDecimals(). Where these
    // two disagree, a driver sees a number that is not the number they are paid.
    expect(currencyDecimals('XOF')).toBe(0);
    expect(currencyDecimals('GHS')).toBe(2);
    expect(currencyDecimals('NGN')).toBe(2);
  });
});

describe('roundMoney', () => {
  it('rounds XOF to whole francs', () => {
    expect(roundMoney(d('383.25'), 'XOF').toString()).toBe('383');
    expect(roundMoney(d('383.75'), 'XOF').toString()).toBe('384');
  });

  it('rounds XOF halves away from zero, matching the client rule', () => {
    expect(roundMoney(d('550.5'), 'XOF').toString()).toBe('551');
    expect(roundMoney(d('-550.5'), 'XOF').toString()).toBe('-551');
  });

  it('rounds GHS to two places, half up', () => {
    expect(roundMoney(d('3.8325'), 'GHS').toFixed(2)).toBe('3.83');
    expect(roundMoney(d('1.005'), 'GHS').toFixed(2)).toBe('1.01');
  });

  it('leaves an already-exact amount alone', () => {
    expect(roundMoney(d('900'), 'XOF').toString()).toBe('900');
    expect(roundMoney(d('12.00'), 'GHS').toFixed(2)).toBe('12.00');
  });

  it('is idempotent', () => {
    const once = roundMoney(d('383.25'), 'XOF');
    expect(roundMoney(once, 'XOF').toString()).toBe(once.toString());
  });

  it('keeps a three-part split summing to its total in XOF', () => {
    // The invariant the earnings screen depends on. Rounding each part to two
    // decimals and displaying at zero lets two halves round up in the same
    // breakdown, so the parts stop adding to the whole.
    const total = d('2555');
    const commission = roundMoney(total.mul(d('0.15')), 'XOF');
    const fee = roundMoney(d('100'), 'XOF');
    const net = roundMoney(total.minus(commission).minus(fee), 'XOF');

    expect(commission.plus(fee).plus(net).toString()).toBe(total.toString());
  });
});
