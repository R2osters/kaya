import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, WithdrawalMethod } from '@prisma/client';
import { DriverService } from './driver.service';

describe('DriverService.withdraw', () => {
  const config = { get: jest.fn((k: string) => (k === 'WITHDRAWAL_FEE_PCT' ? 0.01 : undefined)) };
  const ledger = { record: jest.fn() };
  const commission = { calculate: jest.fn() };

  function makePrisma(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({
            id: 'driver1',
            balance: new Prisma.Decimal('200.00'),
            countryCode: 'GHA',
          }),
        update: jest.fn(),
      },
      countryConfig: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          currencyCode: 'GHS',
          withdrawalMethods: ['momo', 'bank_transfer'],
        }),
      },
      withdrawal: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      $transaction: jest.fn(),
      ...overrides,
    };
  }

  const dto = {
    amount: 150,
    method: WithdrawalMethod.momo,
    accountDetails: { phone: '+233201234567', provider: 'mtn' },
  };

  function service(prisma: unknown) {
    return new DriverService(
      prisma as never,
      config as never,
      ledger as never,
      commission as never,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it('creates a withdrawal, applies the 1% fee, and debits the balance', async () => {
    const prisma = makePrisma();
    const tx = {
      user: { update: jest.fn() },
      withdrawal: {
        create: jest.fn().mockResolvedValue({ id: 'w1', feeAmount: new Prisma.Decimal('1.50') }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

    const result = await service(prisma).withdraw('driver1', dto);

    expect(result.id).toBe('w1');
    // Fee = 150 * 0.01 = 1.50
    const createArg = tx.withdrawal.create.mock.calls[0][0].data;
    expect(createArg.feeAmount.toFixed(2)).toBe('1.50');
    // Balance debited by the full amount.
    expect(tx.user.update.mock.calls[0][0].data.balance.decrement.toString()).toBe('150');
    // Ledger row recorded.
    expect(ledger.record).toHaveBeenCalled();
  });

  it('rejects a second withdrawal on the same day', async () => {
    const prisma = makePrisma();
    prisma.withdrawal.count.mockResolvedValue(1);
    await expect(service(prisma).withdraw('driver1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects an amount above the balance', async () => {
    const prisma = makePrisma();
    await expect(
      service(prisma).withdraw('driver1', { ...dto, amount: 500 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a method not enabled for the country', async () => {
    const prisma = makePrisma();
    prisma.countryConfig.findUniqueOrThrow.mockResolvedValue({
      currencyCode: 'XOF',
      withdrawalMethods: ['momo'],
    });
    await expect(
      service(prisma).withdraw('driver1', { ...dto, method: WithdrawalMethod.bank_transfer }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('setOnline', () => {
  it('flips the flag and returns the stored value', async () => {
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({ isOnline: true }),
      },
    };
    const service = new DriverService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.setOnline('driver-1', true)).resolves.toEqual({ isOnline: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'driver-1' },
      data: { isOnline: true },
      select: { isOnline: true },
    });
  });

  it('can go offline again', async () => {
    const prisma = {
      user: { update: jest.fn().mockResolvedValue({ isOnline: false }) },
    };
    const service = new DriverService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.setOnline('driver-1', false)).resolves.toEqual({ isOnline: false });
  });
});
