import { z } from "zod";

/**
 * Defensive coercion for the NestJS/Prisma wire format. Prisma `Decimal` fields
 * serialise to JSON *strings* ("50.00"), and optional relations arrive as null,
 * so every helper accepts both shapes and degrades to a documented fallback
 * rather than throwing mid-screen.
 */

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  }
  return null;
}

export const decimalLike = (fallback = 0) =>
  z.unknown().transform((v) => toNumberOrNull(v) ?? fallback);

export const decimalLikeOrNull = () =>
  z.unknown().transform((v) => toNumberOrNull(v));

export const intLike = (fallback = 0) =>
  z.unknown().transform((v) => {
    const n = toNumberOrNull(v);
    return n === null ? fallback : Math.trunc(n);
  });

export const intLikeOrNull = () =>
  z.unknown().transform((v) => {
    const n = toNumberOrNull(v);
    return n === null ? null : Math.trunc(n);
  });

export const boolLike = (fallback = false) =>
  z.unknown().transform((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.toLowerCase() === "true";
    if (typeof v === "number") return v !== 0;
    return fallback;
  });

export const stringLike = (fallback = "") =>
  z.unknown().transform((v) => (v === null || v === undefined ? fallback : String(v)));

export const stringLikeOrNull = () =>
  z.unknown().transform((v) => (v === null || v === undefined ? null : String(v)));

function toDateOrNull(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Absent required dates degrade to "now", as the Dart `asDate` did. */
export const dateLike = () =>
  z.unknown().transform((v) => toDateOrNull(v) ?? new Date());

export const dateLikeOrNull = () => z.unknown().transform((v) => toDateOrNull(v));

export const jsonMap = () =>
  z.unknown().transform((v) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {},
  );
