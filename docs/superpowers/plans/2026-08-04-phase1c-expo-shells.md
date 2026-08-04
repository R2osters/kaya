# Phase 1C — The two Expo shells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/client` and `apps/driver` as running Expo applications on top of the merged `@kaya/core` and `@kaya/ui`: the full route tree in placeholders, the authentication guard, the query and state providers, the realtime bridge, i18n, and a design-system showcase screen.

**Architecture:** Both apps are Expo 54 with expo-router. Everything shared already exists: `@kaya/core` holds the API client, models, money rules, socket service and translation resources; `@kaya/ui` holds the tokens, components, map registry and the five platform adapters. These apps compose those two and add nothing to them — if a task here wants to write a component or a schema, it belongs in a package, not in an app.

**Tech Stack:** Expo 54, expo-router 6, React 19, React Native 0.81, TanStack Query 5, Zustand 5, jest-expo, Maestro for the smoke flow.

**Scope:** shells only. Every route exists and is reachable, rendering a placeholder that names itself. The real screens are phases 2 and 3. The acceptance bar from the design is: both apps launch, connect to the backend, `/auth/me` answers, and the design system is visible.

## Global Constraints

- **A development build is required, not Expo Go.** `@react-native-firebase/messaging` cannot run under Expo Go. This is the single biggest environment risk in the phase and Task 1 exists to settle it.
- Apps import from `@kaya/core` and `@kaya/ui` only — never a deep path into either, and never from each other.
- No component, schema, money rule or API call is written in an app. If one seems necessary, that is a signal it belongs in a package.
- **No colour literal anywhere.** The lint rule in `@kaya/ui` must be extended to both apps.
- No hardcoded UI copy: every string comes from the i18n resources in `@kaya/core`.
- `@kaya/core` must remain free of `react`, `react-native`, `react-i18next` and `expo-*`. Run its purity lint after any task that touches it.
- TypeScript strict with `noUncheckedIndexedAccess`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Carried risks this phase must settle

These come from the phase 1B ledger and final review. Each is assigned to a task rather than left to surface on a device:

| Risk | Settled in |
|---|---|
| `@maplibre/maplibre-react-native` is not installed; `MapLibreMapView` resolves it lazily against a hand-written ambient type nothing can verify | Task 6 |
| `lucide-react-native`'s peer range excludes React 19 | Task 1 |
| Root `overrides.expo` pin will collide once the apps pin their own Expo | Task 1 |
| `BottomSheetShell` uses fixed bottom padding rather than safe-area insets | Task 5 |
| The layered half-star has never been looked at | Task 5 |
| `RatingStars` testIDs collide when two rating rows share a screen | Task 5 |
| `MapView` has no `resetMapProvider`, so every app test inherits a `jest.resetModules` workaround | Task 6 |

---

### Task 1: Two Expo apps that launch

**Files:**
- Create: `apps/client/{package.json,app.config.ts,tsconfig.json,babel.config.js,jest.config.js,.eslintrc.cjs}`, `apps/client/app/_layout.tsx`, `apps/client/app/index.tsx`; the same set under `apps/driver/`
- Modify: root `package.json` if the workspace globs or the `overrides.expo` pin need adjusting

**Interfaces:**
- Produces: two apps that build and boot, each rendering a single screen that proves `@kaya/ui`'s tokens resolve through the workspace.

This task is deliberately the whole environment problem in one place. Expect it to be the longest, and do not let a later task inherit an unresolved install.

- [ ] **Step 1: Create both apps with the Expo template, then strip them**

Use `npx create-expo-app@latest` with the blank TypeScript template into `apps/client` and `apps/driver`, then remove everything the template adds that this project does not use. Application ids stay provisional: `com.kaya.kaya_client` and `com.kaya.kaya_driver`, per the decisions log — the final name is not chosen, so no branding is hardcoded and `APP_NAME` stays a constant.

- [ ] **Step 2: Wire the workspace dependencies**

Both apps depend on `@kaya/core` and `@kaya/ui` by workspace protocol. Metro must resolve symlinked workspace packages — set `metro.config.js` accordingly and verify by importing a token, not by reading the config.

Three known dependency frictions, all of which must be resolved here rather than worked around later:
- `lucide-react-native`'s peer range excludes React 19. Decide between a root override and a different icon strategy, and record which.
- The root `overrides.expo` pin of `~54.0.0` was added so `jest-expo` resolved the right Expo. Now that the apps pin Expo themselves, check whether that override still helps or now fights them.
- `react-native-reanimated` is a peer dependency of `@kaya/ui`; each app must install it **and** add its Babel plugin. A missing plugin fails at bundle time with a message that does not mention reanimated.

- [ ] **Step 3: Produce a development build and run it**

`@react-native-firebase/messaging` does not run under Expo Go, so `expo prebuild` plus a development build is mandatory. Get at least one app running on a device or emulator before continuing, and **paste the actual evidence into your report** — a screenshot path or the Metro log line showing the bundle served. A phase that assumes this works and discovers otherwise in Task 7 has wasted six tasks.

If a development build cannot be produced in this environment, stop and report that rather than proceeding: every later task's verification depends on it.

- [ ] **Step 4: Prove the packages resolve**

Each app's first screen renders a `KayaButton` and a `Text` styled from `typography`, imported from `@kaya/ui`. Write a test asserting the screen renders, so a broken workspace resolution fails in CI and not only on a device.

- [ ] **Step 5: Extend lint and CI**

Both apps get the colour-literal rule and the no-deep-import rule. Probe each rule with a file that violates it, paste the failing output into your report, then delete the probe — the phase 1A purity rule silently missed a package because nobody did this. Add both apps to CI.

- [ ] **Step 6: Commit**

---

### Task 2: Runtime configuration and the API client

**Files:**
- Create: `apps/*/src/config/env.ts`, `apps/*/src/api/client.ts`
- Modify: `apps/*/app.config.ts`

**Interfaces:**
- Produces: a configured `ApiConfig`, an `axios` instance from `createHttpClient`, and a `KayaApi` instance, each a singleton per app.

Configuration comes from `app.config.ts` through `expo-constants`: `API_BASE_URL`, `MAPS_API_KEY`, `SKIP_AUTH`, `OTP_DISABLED`. No host is baked into a binary.

**`SKIP_AUTH` is dev-only and must be impossible to ship.** Make a production build fail if it is set, and test that. The flag exists so a screen can be opened without a backend; it must never be a way into a real user's account.

`createHttpClient` needs a `TokenStore` and an `onSessionExpired` callback. Wire the first to `@kaya/ui`'s `SecureTokenStore` and the second to the auth store from Task 3 — the session-expiry path is what makes a 401 land on the welcome screen instead of a blank one.

---

### Task 3: Auth store, session restoration and the route guard

**Files:**
- Create: `apps/*/src/state/authStore.ts`, `apps/*/app/_layout.tsx` (guard)
- Test: `apps/*/src/state/authStore.test.ts`, plus a guard test

**Interfaces:**
- Produces: a Zustand store holding `status: "unknown" | "authenticated" | "anonymous"` and the current `User`; a guard that redirects.

Port the `redirect` from `legacy/flutter/client/lib/router.dart` exactly. Its three rules:

1. While `status` is `unknown`, hold on the splash route and go nowhere else. This is what stops a logged-in user seeing the welcome screen for a frame while the token is read from the keychain.
2. When not authenticated, allow only the auth routes; anything else redirects to `/welcome`. The splash route is not a place to stay once the status is known.
3. When authenticated and sitting on an auth route, redirect to `/home`.

Session restoration reads the token through `SecureTokenStore` and calls `/auth/me`. A failure resolves to `anonymous` — it must never leave the app stuck on the splash screen, which is what the `unknown` state would do forever.

Test all three rules and the restoration paths, including a rejecting keychain read, which `SecureTokenStore` degrades to `null`.

---

### Task 4: Providers — query, i18n, safe area

**Files:**
- Modify: `apps/*/app/_layout.tsx`
- Create: `apps/*/src/state/queryClient.ts`

**Interfaces:**
- Produces: the provider stack every screen sits inside.

The `QueryClient` carries the global error handling the design specifies: an `unauthorized` `ApiFailure` after a failed refresh clears the session so the guard sends the user to `/welcome`; `network` and `timeout` surface an offline banner and retry with backoff.

**Money mutations are never retried automatically.** Payment and withdrawal calls must opt out — a silent retry on a payment is a duplicate transaction. Configure that explicitly and test it, rather than relying on a caller to remember.

`KayaI18nProvider` from `@kaya/ui` wraps the tree. The saved language is read asynchronously and passed as the `locale` prop, which is controlled — that path is precisely the scenario the provider was fixed for in phase 1B, so exercise it.

Add `react-native-safe-area-context` and its provider here, which also settles `BottomSheetShell`'s deferred fixed-padding item in Task 5.

---

### Task 5: The route tree in placeholders, and the design-system showcase

**Files:**
- Create: every route file under `apps/client/app/` and `apps/driver/app/`, plus `apps/*/app/_showcase.tsx`

**Interfaces:**
- Produces: every route reachable, each rendering a placeholder naming itself.

Client routes: `index` (splash), `(auth)/welcome`, `(auth)/login`, `(auth)/login-verify`, `(auth)/register`, `(auth)/password-reset`, `(tabs)/home`, `(tabs)/history`, `(tabs)/inbox`, `(tabs)/profile`, `create-order`, `address-search`, `notifications`, `offers/[orderId]`, `payment/index`, `payment/webview`, `payment/receipt`, `tracking/[deliveryId]`, `chat/[deliveryId]`, `rating/[deliveryId]`.

Driver routes: the same auth group; `(tabs)/home`, `(tabs)/earnings`, `(tabs)/inbox`, `(tabs)/profile`; `verify-documents`, `propose/[orderId]`, `delivery/[deliveryId]`, `delivery-detail/[deliveryId]`, `stats`, `history`, `withdraw`, `chat/[deliveryId]`, `rating/[deliveryId]`, `notifications`.

Write a test that enumerates the expected routes and asserts each resolves. A missing route in a file-based router is invisible until someone navigates to it.

**The showcase screen renders every `@kaya/ui` component** — all nine, the four skeletons, and the map fallback — against the reference screenshots in `D:\prototype\Application de livraison ghanéenne\ref\`. It is the phase's visual acceptance surface, and it settles three carried items at once:
- Compare a card and a screen title against the references. The shadow translation and the line-height ratios are the two values most likely to be subtly wrong, and only an eye catches that.
- Look at the half-star. lucide has no half-fill glyph, so it is layered outline plus fill; a visible seam is plausible.
- Render two `RatingStars` on the screen at once. Their testIDs currently collide, which breaks `getByTestId` — fix it in `@kaya/ui`, not here.

---

### Task 6: The realtime bridge and the map registration

**Files:**
- Create: `apps/*/src/realtime/useSocketBridge.ts`, `apps/*/src/map/register.ts`

**Interfaces:**
- Produces: a hook mounted in the root layout that connects the socket and writes inbound events into the query cache; map provider registration at startup.

The bridge follows the rule the design sets, and the distinction matters: events that carry their whole payload are written straight into the cache with `setQueryData` — `location:driver` arrives every five seconds and a refetch per tick is unaffordable on West African mobile data. Events that only signal a partial change, notably `offer:accepted`, invalidate instead.

Rooms are opt-in: nothing arrives without `joinOrder`/`joinDelivery`. Phase 1B found this the hard way — offer events could be subscribed to and would never fire.

Map registration picks MapLibre when no `MAPS_API_KEY` is set and `react-native-maps` when one is. **This is where the MapLibre ambient type finally gets verified against the real package** — install it, render a map on a device, and confirm the interface `MapLibreMapView` was written against matches. Also add `resetMapProvider` to `@kaya/ui` so app tests stop needing `jest.resetModules`.

---

### Task 7: Push registration, and the end-to-end smoke flow

**Files:**
- Create: `apps/*/src/push/registerPush.ts`, `apps/*/maestro/smoke.yaml`

**Interfaces:**
- Produces: push token registration wired to the backend, and a Maestro flow proving the shell works against the dockerised backend.

Register the token on sign-in and **re-register on every `onTokenRefresh`**. FCM rotates tokens, and per the decisions log push is the only channel that reaches a driver about new work — a stale token means a driver silently stops receiving requests and concludes the platform has gone quiet.

The Maestro flow is the phase's acceptance: launch, land on welcome, sign in with a seeded account, arrive at home, open the showcase, and confirm the design system renders. Run it against the dockerised backend.

---

## Self-review

**Spec coverage.** Design § 6 routing → Task 5; the auth guard → Task 3; § 6 state separation → Tasks 3 and 4; § 6 realtime bridge and its `setQueryData`/`invalidate` split → Task 6; § 6 error handling including the no-retry rule on money → Task 4; § 7 native integrations → Tasks 2, 6 and 7; the phase-1 acceptance criterion (both apps launch, `/auth/me` answers, design system visible) → Tasks 1, 3 and 5.

**Out of scope, deliberately.** Every real screen: order creation, offers, payment, tracking, chat, ratings, earnings, withdrawals. Those are phases 2 and 3. A route file here renders its own name and nothing else.

**The task most likely to go wrong is Task 1**, and it is first for that reason. A development build is mandatory rather than optional, three separate dependency frictions are known in advance, and every later task's verification depends on the result. If it cannot be made to work in this environment, the honest outcome is to stop there and say so.

**Carried from phase 1A's final review, still open and not this phase's to fix:** the backend rounds money to two decimals for every currency while the client rounds XOF to zero, so an accumulated balance drifts about half a franc per delivery. It must be settled before the driver earnings screen ships in phase 3.
