import { z } from "zod";

/**
 * Wire enums mirroring the Prisma schema. Values are snake_case exactly as the
 * backend sends them. Unknown values fall back to a safe default rather than
 * throwing, so a backend adding a status never blanks a screen.
 */

function withFallback<T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) {
  return z.unknown().transform((v) =>
    (values as readonly string[]).includes(v as string)
      ? (v as T[number])
      : fallback,
  );
}

function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.unknown().transform((v) =>
    (values as readonly string[]).includes(v as string) ? (v as T[number]) : null,
  );
}

export const USER_ROLES = ["client", "livreur", "both", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRole = withFallback(USER_ROLES, "client");

export const VEHICLE_TYPES = ["moto", "voiture", "camionnette"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export const vehicleType = optionalEnum(VEHICLE_TYPES);

export const ORDER_STATUSES = [
  "draft",
  "published",
  "offers_received",
  "accepted",
  "driver_en_route",
  "picked_up",
  "in_transit",
  "delivered",
  "cancelled",
  "disputed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const orderStatus = withFallback(ORDER_STATUSES, "draft");

export const OFFER_STATUSES = ["pending", "accepted", "rejected", "expired"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export const offerStatus = withFallback(OFFER_STATUSES, "pending");

export const DELIVERY_STATUSES = [
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export const deliveryStatus = withFallback(DELIVERY_STATUSES, "in_progress");

export const CLIENT_PAYMENT_STATUSES = [
  "pending",
  "escrow_held",
  "released",
  "refunded",
] as const;
export type ClientPaymentStatus = (typeof CLIENT_PAYMENT_STATUSES)[number];
export const clientPaymentStatus = withFallback(CLIENT_PAYMENT_STATUSES, "pending");

export const TRANSACTION_TYPES = [
  "payment_in",
  "escrow_release",
  "commission",
  "litigation_fee",
  "driver_payout",
  "withdrawal",
  "refund",
  "adjustment",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export const transactionType = withFallback(TRANSACTION_TYPES, "adjustment");

export const WITHDRAWAL_METHODS = ["momo", "bank_transfer"] as const;
export type WithdrawalMethod = (typeof WITHDRAWAL_METHODS)[number];
export const withdrawalMethod = withFallback(WITHDRAWAL_METHODS, "momo");

export const WITHDRAWAL_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];
export const withdrawalStatus = withFallback(WITHDRAWAL_STATUSES, "pending");

export const NOTIFICATION_TYPES = [
  "order",
  "offer",
  "delivery",
  "payment",
  "withdrawal",
  "rating",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const notificationType = withFallback(NOTIFICATION_TYPES, "system");
