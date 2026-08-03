import { z } from "zod";
import { type Currency, currencyForCountry, parseCountryCode } from "../money/currency";
import {
  boolLike,
  decimalLike,
  intLike,
  intLikeOrNull,
  stringLike,
  stringLikeOrNull,
} from "../wire/coerce";
import { userRole, vehicleType } from "../wire/enums";

/** A platform user (client and/or driver). Mirrors backend `users` (camelCase). */
export const userSchema = z.object({
  id: stringLike(),
  email: stringLike(),
  phone: stringLike(),
  fullName: stringLike(),
  role: userRole,
  countryCode: z.unknown().transform(parseCountryCode),
  age: intLikeOrNull(),
  city: stringLikeOrNull(),
  profilePhoto: stringLikeOrNull(),
  idCardPhoto: stringLikeOrNull(),
  isVerified: boolLike(false),
  isActive: boolLike(true),
  isOnline: boolLike(false),
  ratingDriver: decimalLike(5),
  ratingClient: decimalLike(5),
  totalDeliveries: intLike(0),
  dailyDeliveries: intLike(0),
  balance: decimalLike(0),
  driverLicenseNumber: stringLikeOrNull(),
  driverLicensePhoto: stringLikeOrNull(),
  driverQrCode: stringLikeOrNull(),
  vehicleType,
  vehicleRegistration: stringLikeOrNull(),
  vehiclePhoto: stringLikeOrNull(),
});

export type User = z.infer<typeof userSchema>;

export const isDriver = (u: User): boolean =>
  u.role === "livreur" || u.role === "both";

export const isClient = (u: User): boolean =>
  u.role === "client" || u.role === "both";

export const userCurrency = (u: User): Currency => currencyForCountry(u.countryCode);
