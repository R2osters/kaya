# Phase 2A — The order core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Design:** `docs/superpowers/specs/2026-08-10-phase2a-order-core-design.md`

**Goal:** a client app that can sign in, create and publish an order, watch offers arrive live,
accept one, and follow the driver on a map — against the real backend.

**Architecture:** screens compose `@kaya/core` (models, API, money, socket, query keys) and
`@kaya/ui` (theme, components, map, adapters). Hooks live in `apps/client/src/queries/`, one file
per resource, and are glue only.

## Rules for every task

- No component, schema, money rule or API call written in an app. If one seems necessary, it
  belongs in a package — say so rather than writing it locally.
- Every screen renders four states: loading (`KayaSkeleton*`), empty (`EmptyState`), error (message
  from `toApiFailure`), content.
- No colour literal, no hardcoded UI copy — tokens from `@kaya/ui`, strings from `@kaya/core`'s i18n.
- Realtime writes the cache via `applyRealtimeEvent`; screens join their own rooms.
- TypeScript strict with `noUncheckedIndexedAccess`. Tests alongside the code they cover.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Carried constraints

- **Windows builds need a short path.** This worktree cannot build; use `D:/kc2` (see the phase 1C
  plan's note and the 2026-08-10 handoff).
- **Runtime config is baked at build time.** Changing `API_BASE_URL` or `SKIP_AUTH` needs a rebuild,
  not a Metro restart. `localhost` on an Android emulator is the emulator; the host is `10.0.2.2`.

---

## Task 1 — `PhoneVerifier`, its mock, and the guard that keeps it out of production

Backend. Extract an interface over the three assertions `FirebaseAdminService` exposes, select the
implementation by `FIREBASE_VERIFIER`, and make the mock impossible to ship.

- [ ] `src/auth/phone-verifier.interface.ts` — token + the three assertions, with `PHONE_VERIFIER`.
- [ ] `src/auth/verifiers/firebase.verifier.ts` — today's code behind the interface, unchanged.
- [ ] `src/auth/verifiers/mock.verifier.ts` — accepts `dev:<phone>` only; rejects anything else.
- [ ] Module factory selects on `FIREBASE_VERIFIER`, and **throws at construction** when `mock` is
      selected with `NODE_ENV=production`.
- [ ] `env.schema.ts` + `.env.example`, documented like the payment mock.
- [ ] Tests: phone mismatch rejected; a non-`dev:` token rejected; the production refusal throws;
      the default stays `firebase`.

**Done when:** `npm test` in `backend/` is green and a login against a local backend with
`FIREBASE_VERIFIER=mock` returns a token pair.

## Task 2 — The minimal login screen

- [ ] `src/queries/auth.ts` — the sign-in mutation over `KayaApi.loginOtp`, storing the pair in
      `SecureTokenStore` and flipping `useAuthStore`.
- [ ] `app/(auth)/login.tsx` — phone + code, submit, error from `toApiFailure`, loading state.
- [ ] i18n keys in `@kaya/core` for every string.
- [ ] Tests: success stores the pair and authenticates; failure renders the message and does not.

**Done when:** the app signs in against a local backend and the route guard lets it through.

## Task 3 — Address search

- [ ] `src/queries/geocoding.ts` — `useAddressSearch(text, countryCode)`, debounced, 2-char floor.
- [ ] `app/address-search.tsx` — field, result list, four states, returns the choice to the caller.
- [ ] Tests: below the floor issues no request; a result selection returns a `GeoPoint`.

## Task 4 — Create order

- [ ] `src/queries/pricing.ts` — `usePriceQuote(pickup, dropoff)`, enabled only when both are set.
- [ ] `src/queries/orders.ts` — create and publish mutations.
- [ ] `app/create-order.tsx` — two address fields, size options, description, optional photo through
      `ImageAdapter`, live quote card, submit.
- [ ] Tests: the quote refetches when either point changes; an immediate order creates **and**
      publishes; a Togolese quote renders whole francs.

## Task 5 — Offers

- [ ] `src/queries/offers.ts` — the order's offers, and the accept mutation.
- [ ] `app/offers/[orderId].tsx` — list, live arrival via `offer:new` after `joinOrder`, accept,
      route to tracking.
- [ ] Tests: an `offer:new` for the joined order refreshes the list; accepting routes to the
      returned delivery.

## Task 6 — Tracking

- [ ] `src/queries/deliveries.ts` — the delivery, plus readers for the live status and driver
      position keys.
- [ ] `app/tracking/[deliveryId].tsx` — map with the three markers, 4-step timeline, live status.
- [ ] Tests: a `location:driver` event moves the marker without a refetch; the timeline follows the
      live status rather than the cached delivery.

## Task 7 — The simulated driver

- [ ] `backend/scripts/simulate-driver.ts` — sign in, poll nearby, offer, await acceptance, emit
      positions every 5 s along an Accra route, advance the delivery states.
- [ ] Documented in the README next to the smoke flows.

## Task 8 — Verify on a device

- [ ] Build from `D:/kc2` with a real `API_BASE_URL`, sign in, create an order, watch the script's
      offer arrive, accept, watch the marker move.
- [ ] `apps/client/maestro/smoke-order.yaml` covering that journey.
- [ ] Record what the device showed that the tests did not — the phase 1C device run found four
      such things, and that is the point of doing it.
