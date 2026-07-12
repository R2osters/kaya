# Kaya API (`kaya-api`)

NestJS 10 + TypeScript backend for the Kaya delivery platform. Milestone 1 covers
project foundations, the full Prisma schema, per-country seed data, and the
authentication surface (Architecture doc §3.1).

## Requirements

- Node.js 20+ (developed on 20 LTS; runtime Docker image is `node:20-alpine`)
- Docker + Docker Compose (for Postgres/PostGIS, Redis, MinIO)

## First-time setup

```bash
cd backend
npm install
cp .env.example .env            # adjust if needed; dev defaults work as-is
npm run generate:keys           # writes RS256 keypair to ./keys (gitignored)
```

## Run the stack

From the repository root (`D:\prototype\kaya`):

```bash
docker compose up -d            # api + postgres(postgis) + redis + minio
```

Ports: API `3000`, Postgres `5432`, Redis `6379`, MinIO `9000` (console `9001`).

### Database migrate + seed

Run these against the composed Postgres (host `localhost` from your machine):

```bash
cd backend
npm run prisma:migrate          # prisma migrate dev - creates tables + enables PostGIS
psql "$DATABASE_URL" -f prisma/postgis.sql   # adds the geography GiST index (used in M2)
npm run db:seed                 # country_configs (GHA/TGO/BEN) + admin user
```

### Develop

```bash
npm run start:dev               # watch mode
```

- API base: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs` (Bearer auth, "Authorize" button)
- Health: `GET http://localhost:3000/api/v1/health`

## Verify

```bash
npm run prisma:validate         # schema is valid
npm run build                   # tsc, zero errors
npm test                        # unit tests (e2e auto-skips without a DB)
npm run test:e2e                # register -> otp -> login (needs Postgres up)
```

## Demo (M1 acceptance)

1. Open `/docs`.
2. `POST /auth/register` a Ghana driver (`PCSRC-2024-001234` + `driverQrCode`) and a
   Togo driver (`CPL-TG-2024-005678`).
3. `POST /auth/otp/send` then read the printed `[DEV OTP]` code from the API logs,
   `POST /auth/otp/verify`.
4. `POST /auth/login`, copy `accessToken`, Authorize, then `GET /auth/me`.

## M2 — orders, offers, realtime

### REST (all under `/api/v1`, Bearer auth)

Orders (client unless noted):
- `POST /orders` — create (immediate or scheduled); computes distance + min price.
- `GET /orders` — list my orders.
- `GET /orders/nearby` — *driver*: published orders within radius (PostGIS).
- `GET /orders/:id` — detail (owner client or admin).
- `PUT /orders/:id` — edit a draft (recomputes price if coordinates change).
- `DELETE /orders/:id` — cancel (expires pending offers, notifies bidders).
- `POST /orders/:id/publish` — publish a draft to nearby drivers.
- `GET /calculate-price?pickupLat=&pickupLng=&deliveryLat=&deliveryLng=` — quote.

Offers (reverse auction):
- `POST /orders/:orderId/offers` — *driver*: bid (>= min price, one per driver).
- `GET /orders/:orderId/offers` — *client*: list bids with driver name/rating.
- `POST /offers/:id/accept` — *client*: lock order, expire other bids, create delivery.
- `POST /offers/:id/reject` — *client*: decline a bid.

### Realtime (Socket.io, handshake `auth: { token: <accessToken> }`)

Client → server: `chat:join {delivery_id}`, `location:update {lat,lng}` (driver),
`chat:message {delivery_id, message_text, image_url}`.
Server → client: `order:new`, `offer:new`, `offer:accepted`, `offer:rejected`,
`location:driver {livreur_id,lat,lng,timestamp}`, `chat:message`,
`delivery:status {delivery_id,status,timestamp}`.

Driver GPS is written to Redis every tick and flushed to Postgres at most once
per 30s (keeps proximity search fresh without hammering the DB). The Socket.io
Redis adapter enables multi-instance fan-out; it falls back to in-memory if Redis
is down.

### Scheduler

`OrdersScheduler` runs every minute: publishes scheduled orders once
`scheduled_time - scheduled_publish_buffer_min` is reached, and sends a one-time
client reminder at `scheduled_time - reminder_before_min` (deduplicated).

### Demo (M2 acceptance)

1. Log in as a client; `POST /orders` with two coordinates → returns `published`
   with `minPriceSuggested`.
2. Log in as a nearby online driver; `POST /orders/:id/offers` a price ≥ minimum.
3. As the client, `GET /orders/:id/offers`, then `POST /offers/:id/accept` →
   order locks, a delivery is created, the driver is notified.

## M3 — escrow payments, delivery lifecycle, commission, earnings

### REST (all under `/api/v1`, Bearer auth unless noted)

Payments (escrow):
- `POST /payments/initialize` — *client*: create escrow payment for a delivery, returns hosted-checkout URL.
- `POST /payments/verify` — *client*: poll status; on success funds move to `escrow_held`.
- `POST /payments/webhook/:provider` — *public*: gateway callback (raw-body HMAC verified); idempotent.
- `POST /payments/refund` — *admin*: refund held escrow.

Delivery lifecycle (driver unless noted):
- `GET /deliveries` / `GET /deliveries/:id` — participant view.
- `POST /deliveries/:id/start` → order `driver_en_route` (requires escrow held).
- `POST /deliveries/:id/pickup` → `picked_up` (optional photo).
- `POST /deliveries/:id/transit` → `in_transit`.
- `POST /deliveries/:id/confirm-delivery` → `delivered` **and settles escrow**.
- `POST /deliveries/:id/cancel` — participant; refunds held escrow.

Ratings, earnings:
- `POST /deliveries/:id/rate`, `GET /users/:id/ratings` — two-sided ratings + average.
- `GET /driver/balance | earnings | withdrawals | stats`, `POST /driver/withdraw` (1/day, fee).

### Money model

- **Gateways** behind `PaymentGateway` (`payment-gateway.factory.ts`): Ghana→Paystack,
  Togo/Benin→Kkiapay when keys are set, else the keyless **mock** (full escrow flow works
  in dev). Webhooks are idempotent via a unique `transactions.reference`.
- **Ledger** is append-only (`LedgerService`): every movement is a `transactions` row;
  amounts never mutate (status may advance). Settlement writes `escrow_release`,
  `commission`, `litigation_fee`, `driver_payout` plus a `litigation_fund` entry, all in
  one DB transaction, and credits the driver balance.
- **Degressive commission** (`CommissionService`): tier by the day's delivery number
  (≤6→20%, 7–10→15%, 11–14→12%, ≥15→9%); `net = base − commission − litigation_fee`.
  `CommissionScheduler` resets `daily_deliveries` at local midnight per country
  (Africa/Accra, Africa/Lome, Africa/Porto-Novo), deduped via a Redis marker.
- All money is `Decimal`, rounded HALF_UP to 2 dp.

### Demo (M3 acceptance)

Accept an offer (M2) → `POST /payments/initialize` → `POST /payments/webhook/mock`
with `{"reference":"<ref>"}` (or `/payments/verify`) → delivery `escrow_held` →
driver `start`→`pickup`→`transit`→`confirm-delivery` → escrow settles, ledger balances,
driver balance = net earnings → both parties `rate` → `POST /driver/withdraw`.

## M5 — admin + notifications + e2e

### Admin REST (`/api/v1/admin`, role `admin`)
- `GET /admin/users` (filter role/country/verified/active, paginated), `PUT /admin/users/:id/verify`, `PUT /admin/users/:id/suspend`.
- `GET /admin/orders`, `GET /admin/deliveries` (paginated, status filter).
- `PUT /admin/users/:id/reactivate`.
- `PUT /admin/withdrawals/:id/process` — approve (marks ledger + withdrawal completed) or reject (refunds balance, reverses ledger).
- `GET /admin/disputes` (disputed orders + escrow info), `PUT /admin/disputes/:orderId/resolve` — `refund_client` (refund escrow, optional indemnity from the litigation fund capped by balance, cancel) or `release_driver` (normal settlement); **idempotent**.
- `GET /admin/litigation-fund` (balance + entries), `GET /admin/stats`.
- `PUT /admin/country-config/:code` — live-edit tariffs, commission tiers, radius, providers.

Admin mutations (verify, suspend/reactivate, config, dispute) write an **`audit_logs`** row; verify also stamps `verified_at` / `verified_by_id`.

### Disputes (participant)
- `POST /deliveries/:id/dispute` — open after pickup and before settlement; freezes order+delivery in `disputed`, holding escrow until an admin resolves it.

### Notifications (user)
- `GET /notifications` (paginated, `unreadOnly`), `PUT /notifications/:id/read`, `POST /notifications/read-all`.

### Admin web
`admin/index.html` — a single-file dashboard (login, stats, user verify/suspend, withdrawal processing, litigation fund). Point it at the API base and sign in with the seeded admin.

### E2E tests (`npm run test:e2e`, Postgres required, else auto-skip)
- `test/auth.e2e-spec.ts` — register → OTP → login → me → refresh.
- `test/money-flow.e2e-spec.ts` — register client+driver → verify+online → order → offer → **accept** → **escrow** pay (mock) → 5-step lifecycle → **settlement** (asserts net = base−commission−fee) → ratings → **withdrawal** (1/day, 2nd → 409).
- `test/dispute-flow.e2e-spec.ts` — order to picked_up → client **dispute** → admin **refund_client** (asserts refund ledger row + refunded status) → repeat resolve is a no-op (idempotent).

## Notes for later milestones

- OTP delivery is behind `OtpProvider` (`OTP_PROVIDER` token). `DevOtpProvider` logs
  the code. Add Twilio/SendGrid providers without touching auth logic.
- Object storage is behind `StorageService` (S3 SDK → MinIO in dev, R2/S3 in prod).
- Distance is behind `DistanceProvider` (`MAPS_PROVIDER`): keyless haversine by
  default, Google Distance Matrix when `GOOGLE_MAPS_API_KEY` is set (auto-fallback).
- Push is behind `NotificationProvider` (`FIREBASE_SERVICE_ACCOUNT`): `DevLogProvider`
  logs in dev, `FcmProvider` activates when the service account is set; every push also
  persists a `Notification` row.
- Payments are behind `PaymentGateway` (mock/Paystack/Kkiapay); wire real keys via
  `PAYSTACK_SECRET_KEY` / `KKIAPAY_*`. `M5` (admin) consumes the ledger, litigation fund,
  and pending withdrawals created in M3.
- Run `prisma/postgis.sql` after migrate — it now also creates
  `orders_pickup_gist_idx` for the nearby-orders query.
- `Role.admin` exists for §3.9 admin endpoints (M5) and is enforced by `RolesGuard`.
