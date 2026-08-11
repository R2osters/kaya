import { z } from "zod";
import type { AxiosInstance } from "axios";
import type { CountryCode } from "../money/currency";
import { parseCurrency } from "../money/currency";
import {
  type AuthResult,
  type LoginChallenge,
  type SocialLoginOutcome,
  authResultSchema,
  loginChallengeSchema,
  parseSocialLoginOutcome,
} from "../models/auth";
import { type AddressSuggestion, addressSuggestionSchema } from "../models/address";
import { type CountryConfig, countryConfigSchema } from "../models/countryConfig";
import { type Delivery, deliverySchema } from "../models/delivery";
import { type Message, messageSchema } from "../models/message";
import { type AppNotification, appNotificationSchema } from "../models/notification";
import { type Offer, offerSchema } from "../models/offer";
import { type Order, orderSchema } from "../models/order";
import { type PriceQuote, priceQuoteSchema } from "../models/priceQuote";
import { type Rating, ratingSchema } from "../models/rating";
import { transactionSchema } from "../models/transaction";
import { type User, userSchema } from "../models/user";
import { type Withdrawal, withdrawalSchema } from "../models/withdrawal";
import {
  boolLike,
  dateLike,
  dateLikeOrNull,
  decimalLike,
  decimalLikeOrNull,
  intLike,
  intLikeOrNull,
  isPlainObject,
  stringLike,
  stringLikeOrNull,
} from "../wire/coerce";
import { offerStatus, orderStatus } from "../wire/enums";
// Importing client.ts for its side-effecting `declare module "axios"` augmentation
// (adds `skipAuth`/`retried` to AxiosRequestConfig). Every caller of this file that
// also imports client.ts gets the augmentation for free, but endpoints.ts uses
// `skipAuth` on requests it issues itself, so it must pull the augmentation in too.
import "./client";

const listOf = <T>(schema: { parse: (v: unknown) => T }) => (data: unknown): T[] =>
  Array.isArray(data) ? data.map((item) => schema.parse(item)) : [];

/**
 * Backend list endpoints that paginate (`orders.service.ts` `findMine`,
 * `notifications.service.ts` `list`) wrap their rows in `{ data, page, limit,
 * total }` rather than returning a bare array. Feeding that envelope to
 * `listOf` (which only recognises a top-level array) silently produces `[]`
 * for every real response — this mirrors that shape instead of assuming a
 * bare array like the non-paginated list endpoints use.
 */
export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

const paginatedOf = <T>(schema: { parse: (v: unknown) => T }) => (raw: unknown): Paginated<T> => {
  const obj = isPlainObject(raw) ? raw : {};
  return {
    data: listOf(schema)(obj.data),
    page: intLike(1).parse(obj.page),
    limit: intLike(20).parse(obj.limit),
    total: intLike(0).parse(obj.total),
  };
};

const paymentInitSchema = z.object({
  transactionId: stringLike(),
  reference: stringLike(),
  authorizationUrl: stringLike(),
  amount: decimalLike(0),
  currency: z.unknown().transform(parseCurrency),
  gateway: stringLike(),
});

export type PaymentInit = z.infer<typeof paymentInitSchema>;

/**
 * CORRECTED (Critical): the original schema here was `deliverySchema`, but
 * `payments.service.ts` `verify()` ends with `return { reference, status:
 * result.status }` and `payments.controller.ts`'s `verify` returns that
 * straight through — no delivery is returned. `deliverySchema.parse(...)`
 * required `id`/`orderId`/`livreurId`/`clientPaymentStatus` and threw a
 * ZodError on every real call. This schema matches the actual response and
 * degrades a missing field instead of throwing.
 */
const paymentVerifySchema = z.object({
  reference: stringLike(),
  status: stringLike(),
});

export type PaymentVerification = z.infer<typeof paymentVerifySchema>;

/** `POST /driver/status` answers with the flag as it now stands. */
const driverStatusSchema = z.object({ isOnline: boolLike(false) });

/** `POST /uploads/:prefix` answers with the private object key. */
const uploadResultSchema = z.object({ key: stringLike() });

/**
 * A multipart body carrying one local file.
 *
 * React Native's FormData accepts this `{uri, name, type}` shape for a file
 * part; the DOM typings do not describe it, hence the cast. Appending the uri
 * as a plain string instead uploads the *path text* as the file -- a 40-byte
 * "image" the backend stores without complaint.
 */
function filePart(file: { uri: string; name?: string; type?: string }): FormData {
  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    name: file.name ?? "upload.jpg",
    type: file.type ?? "image/jpeg",
  } as unknown as Blob);
  return form;
}

const balanceSchema = z.object({
  balance: decimalLike(0),
  currency: z.unknown().transform(parseCurrency),
  // CORRECTED: `driver.service.ts` `getBalance()` also returns
  // `recentTransactions` (last 20 ledger rows); the original schema dropped
  // it silently. `transactionSchema`'s other required fields (userId,
  // deliveryId, reference) are absent from this summary shape and degrade to
  // their documented fallbacks, which is fine here — id/type/amount/currency/
  // status/createdAt (the fields this summary actually sends) all line up.
  recentTransactions: z.unknown().transform((v) => listOf(transactionSchema)(v)),
});

export type DriverBalance = z.infer<typeof balanceSchema>;

/**
 * CORRECTED (Critical): every field name here used to be invented rather than
 * read off `driver.service.ts` `getStats()`, which actually returns
 * `dailyDeliveries`, `totalDeliveries`, `balance`, `currency`,
 * `currentCommissionRate`, `nextCommissionRate`, `nextTierThreshold`,
 * `todayEarnings`. None of those keys existed in the old schema
 * (`deliveriesToday`, `deliveriesTotal`, `earningsToday`, `earningsTotal`,
 * `averageRating`, `acceptanceRate`), so every field silently fell back to
 * its default on every real call — the driver stats screen always showed
 * zeros (fives for the invented "averageRating").
 */
export const driverStatsSchema = z.object({
  dailyDeliveries: intLike(0),
  totalDeliveries: intLike(0),
  balance: decimalLike(0),
  currency: z.unknown().transform(parseCurrency),
  currentCommissionRate: decimalLike(0),
  nextCommissionRate: decimalLike(0),
  nextTierThreshold: intLikeOrNull(),
  todayEarnings: decimalLike(0),
});

export type DriverStats = z.infer<typeof driverStatsSchema>;

/**
 * CORRECTED (Critical): `driver.service.ts` `getEarnings()` returns per-
 * delivery payout rows shaped `{ deliveryId, date, clientName, basePrice,
 * commissionRate, commissionAmount, litigationFee, netEarnings }` — nothing
 * like `transactionSchema`'s `{ id, userId, type, amount, currency, status,
 * createdAt }`. Parsing these rows as `Transaction` silently produced
 * `amount: 0`, `currency: "GHS"` (fallback), `type: "adjustment"` (fallback)
 * and `createdAt: now` (fallback) for every row regardless of the real data.
 */
const driverEarningSchema = z.object({
  deliveryId: stringLike(),
  date: dateLikeOrNull(),
  clientName: stringLike(),
  basePrice: decimalLikeOrNull(),
  commissionRate: decimalLikeOrNull(),
  commissionAmount: decimalLikeOrNull(),
  litigationFee: decimalLike(0),
  netEarnings: decimalLikeOrNull(),
});

export type DriverEarning = z.infer<typeof driverEarningSchema>;

/**
 * CORRECTED (Critical): `offers.service.ts` `listOffers()` does not return a
 * bare array of `Offer`. It returns `{ orderId, minPrice, offers: [...] }`,
 * and each entry in `offers` is a flattened bidder summary (`livreurName`,
 * `livreurPhoto`, `livreurRating`, `livreurTotalDeliveries`) rather than an
 * `Offer` with an embedded `livreur` relation. The old code
 * (`listOf(offerSchema)(res.data)`) saw a non-array top level and always
 * returned `[]`.
 */
const orderOfferSchema = z.object({
  id: stringLike(),
  livreurId: stringLike(),
  livreurName: stringLike(),
  livreurPhoto: stringLikeOrNull(),
  livreurRating: decimalLike(5),
  livreurTotalDeliveries: intLike(0),
  proposedPrice: decimalLike(0),
  status: offerStatus,
  createdAt: dateLike(),
  expiresAt: dateLikeOrNull(),
});

export type OrderOffer = z.infer<typeof orderOfferSchema>;

const orderOffersSchema = z.object({
  orderId: stringLike(),
  minPrice: decimalLikeOrNull(),
  offers: z
    .unknown()
    .transform((v) => (Array.isArray(v) ? v.map((o) => orderOfferSchema.parse(o)) : [])),
});

export type OrderOffers = z.infer<typeof orderOffersSchema>;

/**
 * CORRECTED: `orders.service.ts` `nearby()` does not return `Order` rows. It
 * returns a purpose-built shape missing several `Order` fields (clientId,
 * packagePhoto, weightKg, ...) and adding `distanceToPickupKm` — the whole
 * point of a "nearby" search for a driver — which `orderSchema` has no field
 * for and silently dropped.
 */
const nearbyOrderSchema = z
  .object({
    id: stringLike(),
    pickupAddress: stringLike(),
    pickupLat: decimalLike(),
    pickupLng: decimalLike(),
    deliveryAddress: stringLike(),
    deliveryLat: decimalLike(),
    deliveryLng: decimalLike(),
    description: stringLikeOrNull(),
    distanceKm: decimalLikeOrNull(),
    minPriceSuggested: decimalLikeOrNull(),
    status: orderStatus,
    distanceToPickupKm: decimalLike(0),
    createdAt: dateLike(),
  })
  .transform((o) => ({
    id: o.id,
    pickupAddress: o.pickupAddress,
    pickup: { lat: o.pickupLat, lng: o.pickupLng },
    deliveryAddress: o.deliveryAddress,
    dropoff: { lat: o.deliveryLat, lng: o.deliveryLng },
    description: o.description,
    distanceKm: o.distanceKm,
    minPriceSuggested: o.minPriceSuggested,
    status: o.status,
    distanceToPickupKm: o.distanceToPickupKm,
    createdAt: o.createdAt,
  }));

export type NearbyOrder = z.infer<typeof nearbyOrderSchema>;

/**
 * CORRECTED: `ratings.service.ts` `forUser()`'s `ratings` entries are shaped
 * `{ id, score, comment, roleType, fromUser: {id, fullName, profilePhoto},
 * createdAt }` — there is no `deliveryId`/`fromUserId`/`toUserId` at that
 * level (the domain `Rating` shape `ratingSchema` expects) and the rater's
 * name/photo live under an embedded `fromUser`, not a flat id. Parsing list
 * entries with `ratingSchema` produced blank ids and threw away `fromUser`
 * entirely, so a ratings list always showed anonymous entries.
 */
const ratingAuthorSchema = z.object({
  id: stringLike(),
  fullName: stringLike(),
  profilePhoto: stringLikeOrNull(),
});

const ratingListItemSchema = z
  .object({
    id: stringLike(),
    score: intLike(0),
    comment: stringLikeOrNull(),
    roleType: stringLike(),
    fromUser: z.unknown(),
    createdAt: dateLike(),
  })
  .transform((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    roleType: r.roleType,
    fromUser: isPlainObject(r.fromUser) ? ratingAuthorSchema.parse(r.fromUser) : null,
    createdAt: r.createdAt,
  }));

export type RatingListItem = z.infer<typeof ratingListItemSchema>;

const ratingsPageSchema = z.object({
  // `page` and `limit` are carried through: the backend paginates this list, so
  // dropping them would leave a caller unable to fetch the second page.
  page: intLike(1),
  limit: intLike(20),
  average: decimalLike(0),
  count: intLike(0),
  ratings: z
    .unknown()
    .transform((v) =>
      Array.isArray(v) ? v.filter(isPlainObject).map((r) => ratingListItemSchema.parse(r)) : [],
    ),
});

export type RatingsPage = z.infer<typeof ratingsPageSchema>;

export interface NotificationsPage extends Paginated<AppNotification> {
  unread: number;
}

/**
 * The full REST surface. One method per backend endpoint, each parsing the
 * response through its model schema so a contract drift fails here rather than
 * three screens later. Auth entry points carry `skipAuth` so no stale bearer
 * token from a previous session is attached to a request that is meant to
 * establish a new one.
 *
 * Ported from `legacy/flutter/kaya_core/lib/src/api/kaya_api.dart`, cross-checked
 * against the NestJS controllers/services under `backend/src/**\/*.{controller,service}.ts`.
 * Several paths/verbs in the original task brief did not match that source, and
 * several response schemas did not match what the backend actually returns (the
 * Dart client returned untyped maps and gave no signal); see the per-method
 * comments below and task-10-report.md for the full list.
 */
export class KayaApi {
  constructor(private readonly http: AxiosInstance) {}

  // --- Auth -----------------------------------------------------------------

  async register(body: unknown): Promise<AuthResult> {
    const res = await this.http.post("/auth/register", body, { skipAuth: true });
    return authResultSchema.parse(res.data);
  }

  async login(body: unknown): Promise<LoginChallenge> {
    const res = await this.http.post("/auth/login", body, { skipAuth: true });
    return loginChallengeSchema.parse(res.data);
  }

  async loginVerify(body: unknown): Promise<AuthResult> {
    const res = await this.http.post("/auth/login/verify", body, { skipAuth: true });
    return authResultSchema.parse(res.data);
  }

  async loginOtp(body: unknown): Promise<AuthResult> {
    const res = await this.http.post("/auth/login/otp", body, { skipAuth: true });
    return authResultSchema.parse(res.data);
  }

  async socialLogin(body: unknown): Promise<SocialLoginOutcome> {
    const res = await this.http.post("/auth/social", body, { skipAuth: true });
    return parseSocialLoginOutcome(res.data);
  }

  async passwordReset(body: unknown): Promise<void> {
    await this.http.post("/auth/password-reset", body, { skipAuth: true });
  }

  async me(): Promise<User> {
    const res = await this.http.get("/auth/me");
    return userSchema.parse(res.data);
  }

  /**
   * CORRECTED: the task brief listed this as PATCH. Both the Dart client
   * (`AuthApi.updateProfile` -> `_putMap`) and the backend
   * (`auth.controller.ts` @Put('profile')) use PUT.
   */
  async updateProfile(body: unknown): Promise<User> {
    const res = await this.http.put("/auth/profile", body);
    return userSchema.parse(res.data);
  }

  /**
   * CORRECTED: the brief listed `logout()` with no body. The Dart client
   * (`AuthApi.logout(refreshToken)`) and the backend (`LogoutDto.refreshToken`,
   * required) both need the refresh token to revoke in the request body.
   */
  async logout(body: unknown): Promise<void> {
    await this.http.post("/auth/logout", body);
  }

  // --- Geocoding ------------------------------------------------------------

  /**
   * Address type-ahead for the order-creation and address-search screens
   * (`GET /geocoding/search`).
   *
   * `countryCode` is optional here because the backend defaults it to the
   * caller's own country, which is what a screen almost always wants -- an
   * unfiltered search for "Accra" returns places on three continents, and one
   * picked by a tired thumb prices a delivery nobody can explain.
   *
   * Fewer than two characters is rejected by the backend's DTO, so callers
   * should not issue a request below that; the screen shows recent addresses
   * until then.
   */
  async searchAddresses(params: {
    q: string;
    countryCode?: string;
    language?: string;
    limit?: number;
  }): Promise<AddressSuggestion[]> {
    const res = await this.http.get("/geocoding/search", { params });
    return listOf(addressSuggestionSchema)(res.data);
  }

  // --- Orders ---------------------------------------------------------------

  /**
   * CORRECTED: the brief listed this path as `/orders/calculate-price`. Both
   * the Dart client (`PricingApi.quote` -> `_getMap('/calculate-price', ...)`)
   * and the backend (`pricing.controller.ts` @Controller('calculate-price'))
   * mount it at `/calculate-price`, with no `/orders` prefix.
   */
  async calculatePrice(params: {
    pickupLat: number;
    pickupLng: number;
    deliveryLat: number;
    deliveryLng: number;
    countryCode?: CountryCode;
  }): Promise<PriceQuote> {
    const res = await this.http.get("/calculate-price", { params });
    return priceQuoteSchema.parse(res.data);
  }

  async createOrder(body: unknown): Promise<Order> {
    const res = await this.http.post("/orders", body);
    return orderSchema.parse(res.data);
  }

  /**
   * CORRECTED (Critical): `orders.service.ts` `findMine()` returns `{ data,
   * page, limit, total }`, not a bare array. `listOf` only recognises a
   * top-level array, so this always returned `[]` against the real backend.
   */
  async listOrders(params?: Record<string, unknown>): Promise<Paginated<Order>> {
    const res = await this.http.get("/orders", { params });
    return paginatedOf(orderSchema)(res.data);
  }

  /**
   * `orders.service.ts` `findOne()` returns the order spread together with
   * `offersCount` (from a Prisma `_count` select). `orderSchema` has no field
   * for it (and shouldn't gain one — every other order-returning endpoint
   * omits it), so it's parsed separately and merged in here.
   */
  async getOrder(id: string): Promise<Order & { offersCount: number }> {
    const res = await this.http.get(`/orders/${id}`);
    const order = orderSchema.parse(res.data);
    const offersCount = intLike(0).parse(isPlainObject(res.data) ? res.data.offersCount : undefined);
    return { ...order, offersCount };
  }

  async publishOrder(id: string): Promise<Order> {
    const res = await this.http.post(`/orders/${id}/publish`);
    return orderSchema.parse(res.data);
  }

  /**
   * CORRECTED: `orders.service.ts` `nearby()` returns a dedicated shape, not
   * `Order` rows (see `nearbyOrderSchema` above).
   */
  async nearbyOrders(params: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }): Promise<NearbyOrder[]> {
    const res = await this.http.get("/orders/nearby", { params });
    return listOf(nearbyOrderSchema)(res.data);
  }

  // --- Offers ---------------------------------------------------------------

  async createOffer(orderId: string, body: unknown): Promise<Offer> {
    const res = await this.http.post(`/orders/${orderId}/offers`, body);
    return offerSchema.parse(res.data);
  }

  /**
   * CORRECTED (Critical): `offers.service.ts` `listOffers()` returns
   * `{ orderId, minPrice, offers: [...] }` with flattened bidder summaries,
   * not a bare array of `Offer` (see `orderOffersSchema` above).
   */
  async listOffers(orderId: string): Promise<OrderOffers> {
    const res = await this.http.get(`/orders/${orderId}/offers`);
    return orderOffersSchema.parse(res.data);
  }

  /**
   * CORRECTED (Critical): `offers.service.ts` `acceptOffer()` returns
   * `{ order, delivery, offer }` from the acceptance transaction, not a bare
   * `Delivery`. `deliverySchema.parse(res.data)` never threw (every field
   * degrades via the wire coercion helpers) but silently produced a
   * near-empty `Delivery` — id `""`, status/clientPaymentStatus falling back
   * to their defaults — on every real call.
   */
  async acceptOffer(offerId: string): Promise<Delivery> {
    const res = await this.http.post(`/offers/${offerId}/accept`);
    const payload = isPlainObject(res.data) ? res.data : {};
    return deliverySchema.parse(payload.delivery);
  }

  /**
   * NOTE: the Dart client's `OffersApi.reject` discards the response body and
   * returns `void`, but the backend (`offers.service.ts` `rejectOffer`) does
   * return the updated `Offer`. Parsing it here matches the backend's actual
   * contract rather than the Dart client's incomplete use of it.
   */
  async rejectOffer(offerId: string): Promise<Offer> {
    const res = await this.http.post(`/offers/${offerId}/reject`);
    return offerSchema.parse(res.data);
  }

  // --- Deliveries -----------------------------------------------------------

  async getDelivery(id: string): Promise<Delivery> {
    const res = await this.http.get(`/deliveries/${id}`);
    return deliverySchema.parse(res.data);
  }

  async listDeliveries(params?: Record<string, unknown>): Promise<Delivery[]> {
    const res = await this.http.get("/deliveries", { params });
    return listOf(deliverySchema)(res.data);
  }

  async startDelivery(id: string): Promise<Delivery> {
    const res = await this.http.post(`/deliveries/${id}/start`);
    return deliverySchema.parse(res.data);
  }

  async pickupDelivery(id: string, body: unknown): Promise<Delivery> {
    const res = await this.http.post(`/deliveries/${id}/pickup`, body);
    return deliverySchema.parse(res.data);
  }

  async transitDelivery(id: string): Promise<Delivery> {
    const res = await this.http.post(`/deliveries/${id}/transit`);
    return deliverySchema.parse(res.data);
  }

  async confirmDelivery(id: string, body: unknown): Promise<Delivery> {
    const res = await this.http.post(`/deliveries/${id}/confirm-delivery`, body);
    return deliverySchema.parse(res.data);
  }

  /**
   * Body is optional to mirror the Dart client's `DeliveriesApi.cancel(id,
   * {reason})` and the backend's `CancelDeliveryDto.reason` (optional).
   */
  async cancelOrder(deliveryId: string, body?: unknown): Promise<Delivery> {
    const res = await this.http.post(`/deliveries/${deliveryId}/cancel`, body);
    return deliverySchema.parse(res.data);
  }

  // --- Payments -------------------------------------------------------------

  /**
   * CORRECTED: `payments.service.ts` `initialize()` also returns
   * `transactionId`, `amount`, `currency` and `gateway` alongside
   * `authorizationUrl`/`reference`; the original schema silently dropped them.
   */
  async initializePayment(body: unknown): Promise<PaymentInit> {
    const res = await this.http.post("/payments/initialize", body);
    return paymentInitSchema.parse(res.data);
  }

  /**
   * CORRECTED (Critical, Finding 1): see `paymentVerifySchema` above. The
   * previous schema (`deliverySchema`) threw a ZodError on every real call
   * because the backend never returns a delivery from this endpoint.
   */
  async verifyPayment(body: unknown): Promise<PaymentVerification> {
    const res = await this.http.post("/payments/verify", body);
    return paymentVerifySchema.parse(res.data);
  }

  // --- Chat -----------------------------------------------------------------

  async listMessages(deliveryId: string): Promise<Message[]> {
    const res = await this.http.get(`/deliveries/${deliveryId}/messages`);
    return listOf(messageSchema)(res.data);
  }

  async sendMessage(deliveryId: string, body: unknown): Promise<Message> {
    const res = await this.http.post(`/deliveries/${deliveryId}/messages`, body);
    return messageSchema.parse(res.data);
  }

  /**
   * CORRECTED: the brief listed POST `/deliveries/{deliveryId}/messages/{messageId}/read`.
   * Both the Dart client (`MessagesApi.markRead` -> `_putMap('/messages/$messageId/read')`)
   * and the backend (`messages.controller.ts` @Put('messages/:id/read')) address the
   * message directly, with no deliveryId segment, and use PUT. `deliveryId` is kept
   * as a parameter for call-site ergonomics but is not part of the request.
   */
  async markMessageRead(deliveryId: string, messageId: string): Promise<void> {
    void deliveryId;
    await this.http.put(`/messages/${messageId}/read`);
  }

  // --- Ratings --------------------------------------------------------------

  async rateDelivery(deliveryId: string, body: unknown): Promise<Rating> {
    const res = await this.http.post(`/deliveries/${deliveryId}/rate`, body);
    return ratingSchema.parse(res.data);
  }

  /**
   * CORRECTED: the brief listed GET `/ratings` with a `userId` query param.
   * Both the Dart client (`RatingsApi.forUser` -> `_getMap('/users/$userId/ratings')`)
   * and the backend (`ratings.controller.ts` @Get('users/:id/ratings')) use a
   * path segment instead.
   *
   * CORRECTED (Critical): the response's `ratings` entries are not `Rating`
   * rows (see `ratingsPageSchema` above) — `RatingSummary`/`ratingSchema` from
   * `models/rating.ts` produced blank ids and dropped the rater's name/photo.
   */
  async listRatings(userId: string): Promise<RatingsPage> {
    const res = await this.http.get(`/users/${userId}/ratings`);
    return ratingsPageSchema.parse(res.data);
  }

  // --- Identity documents ---------------------------------------------------

  /**
   * Uploads the national ID card photo (`POST /auth/upload-id`) and returns
   * the updated user.
   *
   * Distinct from `uploadImage` on purpose: these two write the key onto the
   * user row themselves, into `idCardPhoto` and `driverLicensePhoto`. A
   * generic upload would hand back a key nothing then stores, and a driver
   * would submit documents that never reach their file.
   */
  async uploadIdCard(file: { uri: string; name?: string; type?: string }): Promise<User> {
    const res = await this.http.post("/auth/upload-id", filePart(file), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return userSchema.parse(res.data);
  }

  /** Uploads the driving licence photo (`POST /auth/upload-license`). */
  async uploadLicense(file: { uri: string; name?: string; type?: string }): Promise<User> {
    const res = await this.http.post("/auth/upload-license", filePart(file), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return userSchema.parse(res.data);
  }

  // --- Uploads --------------------------------------------------------------

  /**
   * Uploads an image and returns the storage KEY to persist
   * (`POST /uploads/:prefix`).
   *
   * A key, not a URL, and deliberately: the bucket is private, and reads go
   * through short-lived presigned URLs the backend mints when a response
   * carries the photo. What a caller does with this is put it in the field the
   * photo belongs to -- `pickupDelivery(id, { photoUrl: key })`.
   *
   * `uri` is a local file path from the camera. Callers should compress before
   * sending (ImageAdapter.compress in @kaya/ui): the endpoint caps a request
   * at 8 MB, and a raw phone photo on a Ghanaian mobile connection is a long
   * wait at the exact moment the driver is standing at a door.
   */
  async uploadImage(
    prefix: "delivery-photos" | "profile-photos",
    file: { uri: string; name?: string; type?: string },
  ): Promise<{ key: string }> {
    const res = await this.http.post(`/uploads/${prefix}`, filePart(file), {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return uploadResultSchema.parse(res.data);
  }

  // --- Country configuration ------------------------------------------------

  /**
   * The tariff card for one country (`GET /country-configs/:code`): price per
   * km, base pickup fee, the four commission tiers, the litigation fee,
   * search radius and the withdrawal methods available there.
   *
   * Read by the driver's bid screen, which cannot show an honest
   * net-after-commission without the tiers and the fee, and by the withdrawal
   * screen, which must not offer a method the country does not have.
   */
  async countryConfig(countryCode: string): Promise<CountryConfig> {
    const res = await this.http.get(`/country-configs/${countryCode}`);
    return countryConfigSchema.parse(res.data);
  }

  /** Every active country configuration. */
  async countryConfigs(): Promise<CountryConfig[]> {
    const res = await this.http.get("/country-configs");
    return listOf(countryConfigSchema)(res.data);
  }

  // --- Driver status --------------------------------------------------------

  /**
   * Flips whether the driver is accepting work (`POST /driver/status`).
   *
   * The flag is a precondition, not a preference: `OffersService.create()`
   * refuses a bid from an offline driver, so a driver who never went online
   * can do nothing at all in this app. See the endpoint's own note in
   * backend/src/driver/driver.service.ts for why it had to be added.
   */
  async setDriverStatus(online: boolean): Promise<{ isOnline: boolean }> {
    const res = await this.http.post("/driver/status", { online });
    return driverStatusSchema.parse(res.data);
  }

  // --- Driver money ---------------------------------------------------------

  async driverBalance(): Promise<DriverBalance> {
    const res = await this.http.get("/driver/balance");
    return balanceSchema.parse(res.data);
  }

  /**
   * CORRECTED (Critical): see `driverEarningSchema` above. Parsing these rows
   * as `Transaction` silently produced `amount: 0`/fallback currency/fallback
   * type/`createdAt: now` on every row.
   */
  async driverEarnings(params?: Record<string, unknown>): Promise<DriverEarning[]> {
    const res = await this.http.get("/driver/earnings", { params });
    return listOf(driverEarningSchema)(res.data);
  }

  /**
   * CORRECTED (Critical): see `driverStatsSchema` above. Every field name was
   * invented rather than read off the backend and always fell back to its
   * default.
   */
  async driverStats(params?: Record<string, unknown>): Promise<DriverStats> {
    const res = await this.http.get("/driver/stats", { params });
    return driverStatsSchema.parse(res.data);
  }

  async requestWithdrawal(body: unknown): Promise<Withdrawal> {
    const res = await this.http.post("/driver/withdraw", body);
    return withdrawalSchema.parse(res.data);
  }

  async listWithdrawals(): Promise<Withdrawal[]> {
    const res = await this.http.get("/driver/withdrawals");
    return listOf(withdrawalSchema)(res.data);
  }

  // --- Notifications --------------------------------------------------------

  /**
   * CORRECTED (Critical): `notifications.service.ts` `list()` returns
   * `{ data, page, limit, total, unread }`, not a bare array — the same
   * paginated-envelope bug as `listOrders` (see `Paginated<T>` above), plus an
   * `unread` badge count the original schema had no way to surface.
   */
  async listNotifications(params?: Record<string, unknown>): Promise<NotificationsPage> {
    const res = await this.http.get("/notifications", { params });
    const obj = isPlainObject(res.data) ? res.data : {};
    return { ...paginatedOf(appNotificationSchema)(res.data), unread: intLike(0).parse(obj.unread) };
  }

  /**
   * CORRECTED: the brief listed this as POST. Both the Dart client
   * (`NotificationsApi.markRead` -> `_putMap('/notifications/$id/read')`) and
   * the backend (`notifications.controller.ts` @Put(':id/read')) use PUT. (The
   * backend also keeps a POST alias for `read-all` only, not for a single id.)
   */
  async markNotificationRead(id: string): Promise<void> {
    await this.http.put(`/notifications/${id}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.http.post("/notifications/read-all");
  }
}
