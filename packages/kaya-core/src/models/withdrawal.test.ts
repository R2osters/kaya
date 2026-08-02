import { isRead, appNotificationSchema } from "./notification";
import { isCredit, transactionSchema } from "./transaction";
import { withdrawalNetAmount, withdrawalSchema } from "./withdrawal";

describe("withdrawalSchema", () => {
  it("keeps accountDetails as an opaque map and nets the fee", () => {
    const w = withdrawalSchema.parse({
      id: "w1",
      livreurId: "u1",
      amount: "120.00",
      method: "momo",
      status: "pending",
      feeAmount: "1.20",
      accountDetails: { provider: "MTN", number: "0244000184" },
      requestedAt: "2026-08-02T09:00:00.000Z",
    });
    expect(w.amount).toBe(120);
    expect(w.feeAmount).toBe(1.2);
    expect(withdrawalNetAmount(w)).toBe(118.8);
    expect(w.accountDetails).toEqual({ provider: "MTN", number: "0244000184" });
    expect(w.processedAt).toBeNull();
  });
});

describe("transactionSchema", () => {
  it("classifies credits and debits by type", () => {
    const credit = transactionSchema.parse({
      id: "t1",
      userId: "u1",
      type: "driver_payout",
      amount: "22.80",
      currency: "GHS",
      status: "completed",
      createdAt: "2026-08-02T11:00:00.000Z",
    });
    const debit = transactionSchema.parse({
      id: "t2",
      userId: "u1",
      type: "commission",
      amount: "4.20",
      currency: "GHS",
      status: "completed",
      createdAt: "2026-08-02T11:00:00.000Z",
    });
    expect(isCredit(credit)).toBe(true);
    expect(isCredit(debit)).toBe(false);
  });
});

describe("appNotificationSchema", () => {
  it("derives isRead from readAt", () => {
    const unread = appNotificationSchema.parse({
      id: "n1",
      type: "offer",
      title: "New offer",
      body: "Kwame proposed 28 GHS",
      createdAt: "2026-08-02T10:05:00.000Z",
    });
    const read = appNotificationSchema.parse({
      ...unread,
      readAt: "2026-08-02T10:06:00.000Z",
      createdAt: "2026-08-02T10:05:00.000Z",
    });
    expect(isRead(unread)).toBe(false);
    expect(isRead(read)).toBe(true);
    expect(unread.data).toEqual({});
  });

  it("falls back to the system type on an unknown value", () => {
    const n = appNotificationSchema.parse({ id: "n2", type: "teleport" });
    expect(n.type).toBe("system");
  });
});
