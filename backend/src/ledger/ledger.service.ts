import { Injectable } from '@nestjs/common';
import {
  Currency,
  PaymentMethod,
  Prisma,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** A Prisma client or an interactive-transaction client. */
export type PrismaTx = PrismaService | Prisma.TransactionClient;

export interface LedgerEntryInput {
  userId: string;
  deliveryId?: string | null;
  type: TransactionType;
  amount: Prisma.Decimal;
  currency: Currency;
  status?: TransactionStatus;
  reference?: string | null;
  paymentMethod?: PaymentMethod | null;
  metadata?: Prisma.InputJsonValue;
  processedAt?: Date | null;
}

/**
 * Append-only financial ledger. Every money movement is a Transaction row;
 * amounts are never mutated after creation (status may advance
 * pending -> completed/failed/reversed). The litigation fund keeps a running
 * balance_after per entry.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: LedgerEntryInput, tx: PrismaTx = this.prisma): Promise<Transaction> {
    return tx.transaction.create({
      data: {
        userId: input.userId,
        deliveryId: input.deliveryId ?? null,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        status: input.status ?? TransactionStatus.completed,
        reference: input.reference ?? null,
        paymentMethod: input.paymentMethod ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
        processedAt: input.processedAt ?? new Date(),
      },
    });
  }

  /** Advances a transaction's status (e.g. pending payment -> completed). */
  async markStatus(
    id: string,
    status: TransactionStatus,
    tx: PrismaTx = this.prisma,
  ): Promise<Transaction> {
    return tx.transaction.update({
      where: { id },
      data: { status, processedAt: new Date() },
    });
  }

  /**
   * Appends a litigation-fund entry, computing balance_after from the previous
   * entry. Must run inside the same transaction as the source ledger row.
   */
  async addLitigationEntry(
    input: { transactionId: string; amount: Prisma.Decimal; description: string; createdBy?: string | null },
    tx: PrismaTx = this.prisma,
  ): Promise<void> {
    // Serialize concurrent litigation-fund writers so balance_after stays
    // consistent (transaction-scoped advisory lock; auto-released on commit).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4823001)`;
    const last = await tx.litigationFund.findFirst({ orderBy: { createdAt: 'desc' } });
    const previous = last ? new Prisma.Decimal(last.balanceAfter) : new Prisma.Decimal(0);
    const balanceAfter = previous.plus(input.amount);

    await tx.litigationFund.create({
      data: {
        transactionId: input.transactionId,
        amount: input.amount,
        description: input.description,
        balanceAfter,
        createdBy: input.createdBy ?? null,
      },
    });
  }

  async findByReference(reference: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({ where: { reference } });
  }
}
