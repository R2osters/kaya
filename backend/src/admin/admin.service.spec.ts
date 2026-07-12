import { BadRequestException } from '@nestjs/common';
import { Prisma, TransactionStatus, WithdrawalStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { WithdrawalAction } from './dto/admin.dto';

describe('AdminService.processWithdrawal', () => {
  const notifications = { notify: jest.fn() };
  const ledger = { record: jest.fn(), addLitigationEntry: jest.fn() };
  const deliveries = { settle: jest.fn() };

  function makeService(tx: Record<string, unknown>) {
    const prisma = { $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)) };
    return new AdminService(
      prisma as never,
      notifications as never,
      ledger as never,
      deliveries as never,
    );
  }

  const pendingWithdrawal = {
    id: 'w1',
    livreurId: 'driver1',
    amount: new Prisma.Decimal('150.00'),
    status: WithdrawalStatus.pending,
  };

  beforeEach(() => jest.clearAllMocks());

  it('approves a withdrawal: marks the ledger row and withdrawal completed', async () => {
    const tx = {
      withdrawal: {
        findUnique: jest.fn().mockResolvedValue(pendingWithdrawal),
        update: jest.fn().mockResolvedValue({ ...pendingWithdrawal, status: WithdrawalStatus.completed }),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tx1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn() },
    };
    const service = makeService(tx);

    await service.processWithdrawal('w1', 'admin1', { action: WithdrawalAction.approve });

    expect(tx.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TransactionStatus.completed }) }),
    );
    expect(tx.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WithdrawalStatus.completed, processedBy: 'admin1' }),
      }),
    );
    // No balance change on approval (already debited at request time).
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects a withdrawal: refunds the balance and reverses the ledger row', async () => {
    const tx = {
      withdrawal: {
        findUnique: jest.fn().mockResolvedValue(pendingWithdrawal),
        update: jest.fn().mockResolvedValue({ ...pendingWithdrawal, status: WithdrawalStatus.failed }),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tx1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(tx);

    await service.processWithdrawal('w1', 'admin1', {
      action: WithdrawalAction.reject,
      rejectionReason: 'Invalid account',
    });

    // Balance refunded by the reserved amount.
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'driver1' },
        data: { balance: { increment: pendingWithdrawal.amount } },
      }),
    );
    expect(tx.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TransactionStatus.reversed }) }),
    );
    expect(tx.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WithdrawalStatus.failed, rejectionReason: 'Invalid account' }),
      }),
    );
  });

  it('rejects processing a non-pending withdrawal', async () => {
    const tx = {
      withdrawal: {
        findUnique: jest.fn().mockResolvedValue({ ...pendingWithdrawal, status: WithdrawalStatus.completed }),
      },
    };
    const service = makeService(tx);
    await expect(
      service.processWithdrawal('w1', 'admin1', { action: WithdrawalAction.approve }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminService.resolveDispute idempotency', () => {
  const notifications = { notify: jest.fn() };
  const ledger = { record: jest.fn(), addLitigationEntry: jest.fn() };
  const deliveries = { settle: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('is a no-op when the order is no longer disputed (no duplicate ledger rows)', async () => {
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue({ id: 'o1', status: 'delivered', delivery: { id: 'd1' } }) },
      $transaction: jest.fn(),
    };
    const service = new AdminService(
      prisma as never,
      notifications as never,
      ledger as never,
      deliveries as never,
    );

    const res = await service.resolveDispute('o1', 'admin1', { outcome: 'refund_client' as never });
    expect(res).toEqual({ orderId: 'o1', resolved: false, status: 'delivered' });
    expect(ledger.record).not.toHaveBeenCalled();
    expect(deliveries.settle).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('release_driver delegates to the idempotent settlement', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o1',
          status: 'disputed',
          clientId: 'client1',
          delivery: { id: 'd1', basePrice: '20', clientPaymentStatus: 'escrow_held' },
        }),
        update: jest.fn(),
      },
      delivery: { update: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new AdminService(
      prisma as never,
      notifications as never,
      ledger as never,
      deliveries as never,
    );

    const res = await service.resolveDispute('o1', 'admin1', { outcome: 'release_driver' as never });
    expect(deliveries.settle).toHaveBeenCalledWith('d1');
    expect(res).toEqual({ orderId: 'o1', resolved: true, outcome: 'release_driver' });
  });
});
