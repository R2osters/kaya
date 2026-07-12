import { BadRequestException } from '@nestjs/common';
import {
  ClientPaymentStatus,
  DeliveryStatus,
  DriverPayoutStatus,
  OrderStatus,
  Prisma,
  TransactionType,
} from '@prisma/client';
import { CommissionService } from '../commission/commission.service';
import { DeliveriesService } from './deliveries.service';

describe('DeliveriesService.settle (escrow settlement money path)', () => {
  const commission = new CommissionService();
  const ledger = { record: jest.fn(), addLitigationEntry: jest.fn() };
  const notifications = { notify: jest.fn() };
  const realtime = { emitDeliveryStatus: jest.fn() };

  const config = {
    currencyCode: 'GHS',
    commissionTier1: new Prisma.Decimal('0.20'),
    commissionTier2: new Prisma.Decimal('0.15'),
    commissionTier3: new Prisma.Decimal('0.12'),
    commissionTier4: new Prisma.Decimal('0.09'),
    litigationFee: new Prisma.Decimal('1.00'),
  };

  function buildTx(delivery: Record<string, unknown>) {
    return {
      delivery: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(delivery),
        count: jest.fn().mockResolvedValue(0), // no deliveries settled yet today -> ordinal 1
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'd1', ...data })),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'driver1', countryCode: 'GHA' }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ dailyDeliveries: 1 }) // counter increment
          .mockResolvedValueOnce({}), // balance increment
      },
      countryConfig: { findUniqueOrThrow: jest.fn().mockResolvedValue(config) },
    };
  }

  function makeService(tx: unknown) {
    const prisma = {
      $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    };
    return new DeliveriesService(
      prisma as never,
      commission,
      ledger as never,
      notifications as never,
      realtime as never,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it('credits net earnings, writes the four ledger rows and the litigation entry', async () => {
    ledger.record.mockResolvedValue({ id: 'lit-tx' });
    const tx = buildTx({
      id: 'd1',
      livreurId: 'driver1',
      basePrice: new Prisma.Decimal('100.00'),
      driverPayoutStatus: DriverPayoutStatus.pending,
      clientPaymentStatus: ClientPaymentStatus.escrow_held,
      order: { clientId: 'client1' },
    });
    const service = makeService(tx);

    await service.settle('d1');

    // Balance credited with net earnings: 100 - 20 - 1 = 79.
    const balanceCall = tx.user.update.mock.calls[1][0];
    expect(balanceCall.data.balance.increment.toString()).toBe('79');

    // Four ledger rows in order.
    const types = ledger.record.mock.calls.map((c) => c[0].type);
    expect(types).toEqual([
      TransactionType.escrow_release,
      TransactionType.commission,
      TransactionType.litigation_fee,
      TransactionType.driver_payout,
    ]);
    // Amounts.
    expect(ledger.record.mock.calls[0][0].amount.toString()).toBe('100'); // escrow_release = base
    expect(ledger.record.mock.calls[1][0].amount.toFixed(2)).toBe('20.00'); // commission
    expect(ledger.record.mock.calls[3][0].amount.toFixed(2)).toBe('79.00'); // payout = net

    // Litigation fund entry with the fee.
    expect(ledger.addLitigationEntry).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'lit-tx' }),
      tx,
    );

    // Delivery flipped to released/processed.
    const updateData = tx.delivery.update.mock.calls[0][0].data;
    expect(updateData.clientPaymentStatus).toBe(ClientPaymentStatus.released);
    expect(updateData.driverPayoutStatus).toBe(DriverPayoutStatus.processed);
    expect(updateData.netEarnings.toFixed(2)).toBe('79.00');
  });

  it('is idempotent: an already-settled delivery writes no ledger rows', async () => {
    const tx = buildTx({
      id: 'd1',
      livreurId: 'driver1',
      basePrice: new Prisma.Decimal('100.00'),
      driverPayoutStatus: DriverPayoutStatus.processed, // already settled
      clientPaymentStatus: ClientPaymentStatus.released,
      order: { clientId: 'client1' },
    });
    const service = makeService(tx);

    await service.settle('d1');
    expect(ledger.record).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('DeliveriesService lifecycle state machine (illegal transitions)', () => {
  const commission = new CommissionService();
  const ledger = { record: jest.fn(), addLitigationEntry: jest.fn() };
  const notifications = { notify: jest.fn() };
  const realtime = { emitDeliveryStatus: jest.fn() };

  function makeService(delivery: Record<string, unknown>) {
    const prisma = {
      delivery: { findUnique: jest.fn().mockResolvedValue(delivery) },
      $transaction: jest.fn(),
    };
    const service = new DeliveriesService(
      prisma as never,
      commission,
      ledger as never,
      notifications as never,
      realtime as never,
    );
    return { service, prisma };
  }

  const base = {
    id: 'd1',
    orderId: 'o1',
    livreurId: 'driver1',
    status: DeliveryStatus.in_progress,
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects start before escrow is held', async () => {
    const { service, prisma } = makeService({
      ...base,
      clientPaymentStatus: ClientPaymentStatus.pending,
      order: { status: OrderStatus.accepted, clientId: 'client1' },
    });
    await expect(service.start('d1', 'driver1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects pickup before the driver has started (order not driver_en_route)', async () => {
    const { service, prisma } = makeService({
      ...base,
      clientPaymentStatus: ClientPaymentStatus.escrow_held,
      order: { status: OrderStatus.accepted, clientId: 'client1' },
    });
    await expect(service.pickup('d1', 'driver1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects transit before pickup', async () => {
    const { service } = makeService({
      ...base,
      order: { status: OrderStatus.driver_en_route, clientId: 'client1' },
    });
    await expect(service.transit('d1', 'driver1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects confirm-delivery after cancellation', async () => {
    const { service } = makeService({
      ...base,
      status: DeliveryStatus.cancelled,
      order: { status: OrderStatus.cancelled, clientId: 'client1' },
    });
    await expect(service.confirmDelivery('d1', 'driver1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects cancelling a delivery that is already completed', async () => {
    const { service } = makeService({
      ...base,
      status: DeliveryStatus.completed,
      order: { status: OrderStatus.delivered, clientId: 'client1' },
    });
    await expect(
      service.cancel('d1', { id: 'client1', role: 'client' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
