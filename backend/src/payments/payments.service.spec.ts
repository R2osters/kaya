import { TransactionStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService.handleWebhook (escrow, idempotent)', () => {
  const gateway = {
    name: 'mock',
    parseWebhook: jest.fn().mockReturnValue({ event: 'charge.success', reference: 'r1', status: 'success' }),
  };
  const gateways = { byName: jest.fn().mockReturnValue(gateway), forCountry: jest.fn() };
  const notifications = { notify: jest.fn() };

  function makePrisma(escrowTx: unknown) {
    return {
      $transaction: jest.fn(),
      transaction: {
        findUnique: jest.fn(),
      },
      _escrowTx: escrowTx,
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('marks a pending payment as escrow_held on first success', async () => {
    const ledger = {
      findByReference: jest.fn().mockResolvedValue({
        id: 't1',
        status: TransactionStatus.pending,
        deliveryId: 'd1',
      }),
    };
    const prisma = makePrisma(null);
    const innerTx = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({ id: 't1', status: TransactionStatus.pending, deliveryId: 'd1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      delivery: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(innerTx));
    // Post-commit lookup for notifications.
    prisma.transaction.findUnique.mockResolvedValue({
      delivery: { id: 'd1', livreurId: 'dr1', order: { clientId: 'c1' } },
    });

    const service = new PaymentsService(
      prisma as never,
      gateways as never,
      ledger as never,
      notifications as never,
    );

    const res = await service.handleWebhook('mock', '{"reference":"r1"}', undefined);
    expect(res).toEqual({ received: true });
    expect(innerTx.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TransactionStatus.completed }) }),
    );
    expect(innerTx.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { clientPaymentStatus: 'escrow_held' } }),
    );
  });

  it('is idempotent: a repeated success for an already-completed payment is a no-op', async () => {
    const ledger = {
      findByReference: jest.fn().mockResolvedValue({
        id: 't1',
        status: TransactionStatus.completed,
        deliveryId: 'd1',
      }),
    };
    const prisma = makePrisma(null);
    const service = new PaymentsService(
      prisma as never,
      gateways as never,
      ledger as never,
      notifications as never,
    );

    const res = await service.handleWebhook('mock', '{"reference":"r1"}', undefined);
    expect(res).toEqual({ received: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns received:true and does nothing for an unknown reference', async () => {
    const ledger = { findByReference: jest.fn().mockResolvedValue(null) };
    const prisma = makePrisma(null);
    const service = new PaymentsService(
      prisma as never,
      gateways as never,
      ledger as never,
      notifications as never,
    );

    const res = await service.handleWebhook('mock', '{"reference":"zzz"}', undefined);
    expect(res).toEqual({ received: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
