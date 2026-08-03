import { z } from "zod";
import type { AxiosInstance } from "axios";
import type { CountryCode } from "../money/currency";
import { type Currency, parseCurrency } from "../money/currency";
import {
  type AuthResult,
  type LoginChallenge,
  type SocialLoginOutcome,
  authResultSchema,
  loginChallengeSchema,
  parseSocialLoginOutcome,
} from "../models/auth";
import { type Delivery, deliverySchema } from "../models/delivery";
import { type Message, messageSchema } from "../models/message";
import { type AppNotification, appNotificationSchema } from "../models/notification";
import { type Offer, offerSchema } from "../models/offer";
import { type Order, orderSchema } from "../models/order";
import { type PriceQuote, priceQuoteSchema } from "../models/priceQuote";
import { type Rating, type RatingSummary, ratingSchema, ratingSummarySchema } from "../models/rating";
import { type Transaction, transactionSchema } from "../models/transaction";
import { type User, userSchema } from "../models/user";
import { type Withdrawal, withdrawalSchema } from "../models/withdrawal";
import { decimalLike, intLike } from "../wire/coerce";
// Importing client.ts for its side-effecting `declare module "axios"` augmentation
// (adds `skipAuth`/`retried` to AxiosRequestConfig). Every caller of this file that
// also imports client.ts gets the augmentation for free, but endpoints.ts uses
// `skipAuth` on requests it issues itself, so it must pull the augmentation in too.
import "./client";

const listOf = <T>(schema: { parse: (v: unknown) => T }) => (data: unknown): T[] =>
  Array.isArray(data) ? data.map((item) => schema.parse(item)) : [];

const paymentInitSchema = z.object({
  authorizationUrl: z.unknown().transform((v) => String(v ?? "")),
  reference: z.unknown().transform((v) => String(v ?? "")),
});

const balanceSchema = z.object({
  balance: decimalLike(0),
  currency: z.unknown().transform(parseCurrency),
});

export const driverStatsSchema = z.object({
  deliveriesToday: intLike(0),
  deliveriesTotal: intLike(0),
  earningsToday: decimalLike(0),
  earningsTotal: decimalLike(0),
  averageRating: decimalLike(5),
  acceptanceRate: decimalLike(0),
});

export type DriverStats = z.infer<typeof driverStatsSchema>;

/**
 * The full REST surface. One method per backend endpoint, each parsing the
 * response through its model schema so a contract drift fails here rather than
 * three screens later. Auth entry points carry `skipAuth` so no stale bearer
 * token from a previous session is attached to a request that is meant to
 * establish a new one.
 *
 * Ported from `legacy/flutter/kaya_core/lib/src/api/kaya_api.dart`, cross-checked
 * against the NestJS controllers under `backend/src/**\/*.controller.ts`. Several
 * paths/verbs in the original task brief did not match that source; see the
 * per-method comments below and task-10-report.md for the full list.
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

  async listOrders(params?: Record<string, unknown>): Promise<Order[]> {
    const res = await this.http.get("/orders", { params });
    return listOf(orderSchema)(res.data);
  }

  async getOrder(id: string): Promise<Order> {
    const res = await this.http.get(`/orders/${id}`);
    return orderSchema.parse(res.data);
  }

  async publishOrder(id: string): Promise<Order> {
    const res = await this.http.post(`/orders/${id}/publish`);
    return orderSchema.parse(res.data);
  }

  async nearbyOrders(params: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }): Promise<Order[]> {
    const res = await this.http.get("/orders/nearby", { params });
    return listOf(orderSchema)(res.data);
  }

  // --- Offers ---------------------------------------------------------------

  async createOffer(orderId: string, body: unknown): Promise<Offer> {
    const res = await this.http.post(`/orders/${orderId}/offers`, body);
    return offerSchema.parse(res.data);
  }

  async listOffers(orderId: string): Promise<Offer[]> {
    const res = await this.http.get(`/orders/${orderId}/offers`);
    return listOf(offerSchema)(res.data);
  }

  async acceptOffer(offerId: string): Promise<Delivery> {
    const res = await this.http.post(`/offers/${offerId}/accept`);
    return deliverySchema.parse(res.data);
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

  async initializePayment(body: unknown): Promise<z.infer<typeof paymentInitSchema>> {
    const res = await this.http.post("/payments/initialize", body);
    return paymentInitSchema.parse(res.data);
  }

  async verifyPayment(body: unknown): Promise<Delivery> {
    const res = await this.http.post("/payments/verify", body);
    return deliverySchema.parse(res.data);
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
   */
  async listRatings(userId: string): Promise<RatingSummary> {
    const res = await this.http.get(`/users/${userId}/ratings`);
    return ratingSummarySchema.parse(res.data);
  }

  // --- Driver money ---------------------------------------------------------

  async driverBalance(): Promise<{ balance: number; currency: Currency }> {
    const res = await this.http.get("/driver/balance");
    return balanceSchema.parse(res.data);
  }

  async driverEarnings(params?: Record<string, unknown>): Promise<Transaction[]> {
    const res = await this.http.get("/driver/earnings", { params });
    return listOf(transactionSchema)(res.data);
  }

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

  async listNotifications(params?: Record<string, unknown>): Promise<AppNotification[]> {
    const res = await this.http.get("/notifications", { params });
    return listOf(appNotificationSchema)(res.data);
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
