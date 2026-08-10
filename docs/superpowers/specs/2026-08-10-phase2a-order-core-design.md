# Phase 2A — The order core (client app) — Design

Date: 2026-08-10
Status: approved

## 1. Why this slice, and why it is not "phase 2"

The migration spec (`2026-08-02-migration-flutter-to-react-native-design.md` §10)
defines phase 2 as "App Client complète (~20 routes)". That is 4 635 lines of
Dart across 41 files and cannot be one spec. Phase 2 decomposes along the
lifecycle of a delivery:

| Slice | Routes | Depends on |
|---|---|---|
| **A — order core** | `login`, `create-order`, `address-search`, `offers/[orderId]`, `tracking/[deliveryId]` | geocoding, price quote, socket bridge, map — all built in phase 1, none of it ever used |
| B — money | `payment`, `payment/webview`, `payment/receipt` | escrow, Paystack/Kkiapay sandbox |
| C — auth | `welcome`, `login-verify`, `register` (3-step wizard), `password-reset`, social login | Firebase Phone Auth |
| D — periphery | `home`, `history`, `inbox`, `chat`, `notifications`, `profile`, `rating` | A and B |

This spec covers **slice A only**. Each later slice gets its own spec.

A is first because it is the only slice that exercises what phase 1 built and
never ran: the geocoding endpoint, the price quote, the realtime cache bridge,
and the map. If any of those is wrong, the cost of learning it now is one
screen; the cost of learning it after fifteen is fifteen.

## 2. Scope

**In:**

- `login` — phone + code, enough to obtain a real token. Nothing else.
- `create-order` — pickup, dropoff, parcel size, description, photo, live quote,
  publish, route to offers.
- `address-search` — type-ahead over `GET /geocoding/search`, returns a GeoPoint.
- `offers/[orderId]` — offer list, live arrival via `offer:new`, accept.
- `tracking/[deliveryId]` — map with the driver's live position, 4-step timeline.

**Out, deliberately:**

- `home`. The route explorer built in phase 1C is the entry point for this
  slice. Building a home screen means building the map summary, the recent
  deliveries list and the CTA — a slice-D screen that would be revisited anyway.
- **Scheduled orders.** `create_order_screen.dart` has a schedule picker sheet.
  It needs a date/time component that does not exist in `@kaya/ui`, and adding
  a shared component mid-slice is how a design system acquires one-off widgets.
  `create-order` will be revisited once when scheduling lands; that is the
  accepted cost.
- The registration wizard, social login, 2FA, password reset — slice C.
- Chat, rating, payment — later slices.

## 3. The blocker, and how it is removed

Every login path on the backend requires a Firebase ID token:
`login/verify`, `login/otp` and `social` all call into `FirebaseAdminService`,
and with no `FIREBASE_SERVICE_ACCOUNT` configured each throws
`Phone verification is not configured on the server.` There is no degraded
mode. On the app side `@react-native-firebase/auth` is not even a dependency.

This is the **only** external integration in the project without a mock
implementation. Payments have one, distance has one, geocoding has one, SMS has
one, push has one — `CLAUDE.md` requires it ("toujours derrière une interface
avec implémentation mock/sandbox utilisable sans clé") and this is where the
rule was not held.

### Design

Extract a `PhoneVerifier` interface over the three assertions
`FirebaseAdminService` exposes today, with two implementations selected by a
new `FIREBASE_VERIFIER` env value:

- `firebase` (**default**) — today's code, moved behind the interface unchanged.
- `mock` — accepts a token of the form `dev:<phone>` and asserts it matches the
  expected phone. No network, no account, no Firebase project.

### Safety

This is an authentication bypass and is treated as one, not as a convenience:

- The module **refuses to boot** when `mock` is selected and `NODE_ENV` is
  `production`. It throws at construction; it does not warn and continue. Same
  posture as `tools/devFlagGuard` on the app side, which refuses to *build*
  rather than refusing to run.
- The mock accepts only the `dev:` prefix, so a token that happens to be a real
  Firebase JWT is rejected rather than silently trusted.
- A test asserts the production refusal, and asserts that the mock rejects a
  token whose phone does not match.

`.env.example` documents it in the same register as the payment mock.

## 4. Data conventions

Hooks live in `apps/client/src/queries/`, one file per resource. A hook is glue:
the API method is in `@kaya/core`, the cache key is in `@kaya/core`, the hook
wires the two. No component, schema, money rule or API call is written in the
app — the phase 1C rule holds unchanged.

Three rules every screen in this slice follows:

1. **Four states per screen.** Loading uses the `KayaSkeleton*` family, which
   was built in phase 1B and has never been rendered by an app. Empty uses
   `EmptyState`. Errors render the message from `toApiFailure`, never a raw
   exception. Then content.
2. **Money mutations never replay.** `queryClient.ts` already defaults
   `mutations.retry` to `false`; no call in this slice opts out.
3. **Realtime writes to the cache; it does not trigger refetches.** The policy
   is `applyRealtimeEvent` in `@kaya/core`. Screens subscribe by reading the
   same `queryKeys` the bridge writes to. A screen that wants live offers reads
   `queryKeys.offers(orderId)` and calls `socketService.joinOrder(orderId)` —
   rooms are opt-in and the bridge deliberately joins none.

## 5. Screens

### `login`

Phone + code, two fields, one submit. Calls `POST /auth/login/otp` with
`firebaseIdToken: "dev:<phone>"` under the mock verifier. On success the token
pair goes to `SecureTokenStore` and the auth store flips to `authenticated`,
which the existing route guard already acts on.

It is deliberately ugly-minimal: slice C replaces it with the real screen. Its
job is to make the rest of the slice reachable against a real backend.

### `address-search`

A text field and a result list over `GET /geocoding/search`, debounced, with a
2-character floor matching the backend DTO. Returns the chosen
`AddressSuggestion` to the caller through router params.

Known gap, recorded rather than solved: in Ghana the addressing scheme people
actually use is GhanaPostGPS digital addresses and OSM's peri-urban coverage is
thin. This screen will need a second input and a drop-a-pin fallback. Not in
this slice; the geocoding provider interface does not prevent it.

### `create-order`

Ported from `create_order_screen.dart`. Two address fields opening
`address-search`, parcel size options, description, an optional photo through
`@kaya/ui`'s `ImageAdapter`, and a live quote card.

The quote re-fetches whenever both points are set and either changes, calling
`GET /calculate-price`. It shows `minPrice` in the country's currency — and
this is where the phase 1C money fix earns its place: with `MAPS_PROVIDER=osrm`
a Togolese quote must render as whole francs, not centimes.

Submit creates the order and, for an immediate order, publishes it, then routes
to `offers/[orderId]` — the same two-call sequence the Dart original uses.

### `offers/[orderId]`

Loads the order and its offers over REST, joins the order's socket room, and
folds `offer:new` in. Per `applyRealtimeEvent`, `offer:new` invalidates rather
than writes, because its four-field payload is not an `Offer`.

Accepting calls `POST /offers/:id/accept`, which returns a `Delivery`, and
routes to `tracking/[deliveryId]`.

### `tracking/[deliveryId]`

A map and a 4-step timeline. Joins the delivery room, reads the driver's
position from `queryKeys.driverLocation(livreurId)` — keyed by driver because
the `location:driver` payload carries no delivery id — and the live status from
`queryKeys.deliveryLiveStatus(deliveryId)`.

The map shows pickup, dropoff and the vehicle. The bounds-fitting fixed after
the first device run is what makes all three visible at once.

## 6. Verification

### The simulated driver

`backend/scripts/simulate-driver.ts` signs in as a seeded driver, polls
`/orders/nearby`, offers a price, waits for acceptance, then emits
`location:update` every 5 s along a real Accra route and advances the delivery
through its states.

It drives the real endpoints and the real gateway, so the phase 1C realtime
bridge, the map and the timeline are checked against the server's actual
behaviour rather than against invented data. It is reused in phase 3 as the
control the driver app is compared to.

### Tests

- Hooks and screen logic against `axios-mock-adapter`, the pattern
  `@kaya/core` already uses.
- The mock verifier: phone mismatch rejected, `dev:` prefix required, and the
  production boot refusal.
- The money path: a Togolese quote renders whole francs.

### On a device

Create an order in the app, watch the script's offer arrive live, accept it,
and watch the driver marker move. That journey becomes a Maestro flow
(`smoke-order.yaml`), run against a `SKIP_AUTH=false` build with a real login.

## 7. Out of scope for this spec

Backend business logic, the Prisma schema, the driver app, the admin console,
dark theme, and the provisional application ids — all unchanged.
