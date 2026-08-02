# Phase 1A — Monorepo foundation and `@kaya/core` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the npm-workspaces monorepo, move the Flutter code to `legacy/`, and build `@kaya/core` — the pure-TypeScript shared layer (money, wire coercion, models, errors, HTTP client, realtime, storage interface, i18n resources) with a full jest suite that runs without any mobile toolchain.

**Architecture:** `@kaya/core` never imports `react-native`. Every module whose real implementation touches a native or React API declares an interface here and gets its adapter in `@kaya/ui` (phase 1B). Wire parsing goes through Zod schemas rather than hand-written `fromJson`, so a backend contract change fails loudly instead of yielding `undefined`. The Flutter tree moves to `legacy/flutter/` via `git mv` and stays there as a behavioural reference until phase 3.

**Tech Stack:** TypeScript 5.9 (strict), Zod 3, axios 1, socket.io-client 4, i18next 25, jest 29 + ts-jest, npm workspaces.

## Global Constraints

- `@kaya/core` MUST NOT import `react`, `react-native`, or any `expo-*` package. A lint rule enforces this (Task 14).
- Money uses `number` with a single shared `roundMoney` helper reproducing Dart's `double.parse(x.toStringAsFixed(2))`. Do not introduce `decimal.js`.
- Commission tier is keyed on **the day's delivery number** (1-based): `#1–6 → 0.20`, `#7–10 → 0.15`, `#11–14 → 0.12`, `#15+ → 0.09`. The 7th delivery of the day is charged 15%.
- Currency decimals: `XOF` → 0, `GHS` → 2, `NGN` → 2. Countries: `GHA`, `TGO`, `BEN`.
- Wire enums use snake_case exactly as the backend sends them. Unknown values fall back to a documented default, never throw.
- Prisma `Decimal` values arrive as JSON **strings** (`"50.00"`). Every money field must accept string or number.
- REST prefix is `/api/v1`; socket.io connects to the bare origin.
- App name is read from `APP_NAME`; never hardcode a brand string.
- Code and comments in English. UI strings via i18n FR/EN only.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

```
kaya/
├── package.json                       root, npm workspaces
├── tsconfig.base.json                 shared strict TS config
├── legacy/flutter/{client,driver,kaya_core}/    moved from apps/ and packages/
└── packages/kaya-core/
    ├── package.json                   name: @kaya/core
    ├── tsconfig.json
    ├── jest.config.js
    ├── .eslintrc.cjs                  bans react/react-native/expo imports
    └── src/
        ├── index.ts                   barrel export
        ├── money/
        │   ├── round.ts               roundMoney
        │   ├── currency.ts            CountryCode, Currency, formatMoney
        │   └── commission.ts          commissionRateForDeliveryNumber, CommissionPreview
        ├── wire/
        │   ├── coerce.ts              decimalLike, intLike, boolLike, dateLike, wireEnum
        │   └── enums.ts               UserRole, OrderStatus, … as Zod enums with fallbacks
        ├── models/
        │   ├── geo.ts  user.ts  countryConfig.ts  priceQuote.ts
        │   ├── order.ts  offer.ts  delivery.ts
        │   ├── message.ts  rating.ts  transaction.ts  withdrawal.ts  notification.ts
        │   └── auth.ts
        ├── errors/apiFailure.ts
        ├── api/
        │   ├── config.ts              ApiConfig
        │   ├── client.ts              axios instance + auth interceptor
        │   └── endpoints.ts           KayaApi
        ├── realtime/
        │   ├── events.ts              typed socket payload schemas
        │   └── socket.ts              SocketService
        ├── storage/tokenStore.ts      TokenStore interface + InMemoryTokenStore
        └── i18n/
            ├── fr.json  en.json       converted from the ARB files
            └── index.ts               createI18n()
```

---

### Task 1: Monorepo foundation and the Flutter move

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `packages/kaya-core/package.json`, `packages/kaya-core/tsconfig.json`, `packages/kaya-core/jest.config.js`, `packages/kaya-core/src/money/round.ts`
- Modify: `.gitignore`
- Move: `apps/client` → `legacy/flutter/client`, `apps/driver` → `legacy/flutter/driver`, `packages/kaya_core` → `legacy/flutter/kaya_core`
- Test: `packages/kaya-core/src/money/round.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `roundMoney(value: number): number`. A working `npm test -w @kaya/core`.

- [ ] **Step 1: Move the Flutter tree to `legacy/`**

```bash
mkdir -p legacy/flutter
git mv apps/client legacy/flutter/client
git mv apps/driver legacy/flutter/driver
git mv packages/kaya_core legacy/flutter/kaya_core
```

Verify git recorded renames, not delete+add:

```bash
git status --short | head -5
```

Expected: lines starting with `R ` (renamed). If they start with `D `/`A `, stop and investigate — history linkage is lost.

- [ ] **Step 2: Write the root workspace manifest**

Create `package.json`:

```json
{
  "name": "kaya-monorepo",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "~5.9.2"
  }
}
```

- [ ] **Step 3: Write the shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: Write the `@kaya/core` package manifest**

Create `packages/kaya-core/package.json`:

```json
{
  "name": "@kaya/core",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "axios": "1.13.2",
    "i18next": "^25.2.1",
    "socket.io-client": "^4.8.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "~5.9.2"
  }
}
```

Create `packages/kaya-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

Create `packages/kaya-core/jest.config.js`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleFileExtensions: ["ts", "js", "json"],
};
```

- [ ] **Step 5: Add build output to `.gitignore`**

Append to `.gitignore`:

```
node_modules/
packages/*/dist/
```

- [ ] **Step 6: Install**

Run: `npm install`
Expected: creates `package-lock.json` and a hoisted root `node_modules/`. No `ERESOLVE` errors.

- [ ] **Step 7: Write the failing test for `roundMoney`**

Create `packages/kaya-core/src/money/round.test.ts`:

```ts
import { roundMoney } from "./round";

describe("roundMoney", () => {
  it("keeps two decimals", () => {
    expect(roundMoney(12.345)).toBe(12.35);
    expect(roundMoney(12.344)).toBe(12.34);
  });

  it("drops binary float noise", () => {
    // 28 * 0.15 is 4.199999999999999 in IEEE-754.
    expect(roundMoney(28 * 0.15)).toBe(4.2);
  });

  it("returns whole numbers unchanged", () => {
    expect(roundMoney(30)).toBe(30);
  });

  it("handles negatives symmetrically", () => {
    expect(roundMoney(-12.345)).toBe(-12.35);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test -w @kaya/core`
Expected: FAIL — `Cannot find module './round'`.

- [ ] **Step 9: Write the implementation**

Create `packages/kaya-core/src/money/round.ts`:

```ts
/**
 * Rounds to two decimals the same way the Flutter code did
 * (`double.parse(value.toStringAsFixed(2))`), so client-side previews match
 * the amounts the backend ledger records to the cent.
 */
export function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -w @kaya/core`
Expected: PASS, 4 tests.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore(monorepo): npm workspaces, move Flutter to legacy/, scaffold @kaya/core

The Flutter apps and kaya_core move under legacy/flutter/ with git mv so history
follows; they stay as a behavioural reference until the React Native migration
reaches parity. @kaya/core starts with roundMoney, which reproduces Dart's
double.parse(x.toStringAsFixed(2)) so money previews match the backend ledger.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Countries, currencies and money formatting

**Files:**
- Create: `packages/kaya-core/src/money/currency.ts`
- Test: `packages/kaya-core/src/money/currency.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type CountryCode = "GHA" | "TGO" | "BEN"`, `type Currency = "GHS" | "XOF" | "NGN"`, `COUNTRIES: Record<CountryCode, CountryMeta>`, `currencyDecimals(c: Currency): number`, `currencyForCountry(c: CountryCode): Currency`, `parseCountryCode(v: unknown): CountryCode`, `parseCurrency(v: unknown): Currency`, `formatMoney(amount: number, currency: Currency, opts?: { withSymbol?: boolean }): string`.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/money/currency.test.ts`:

```ts
import {
  COUNTRIES,
  currencyDecimals,
  currencyForCountry,
  formatMoney,
  parseCountryCode,
  parseCurrency,
} from "./currency";

/** ICU emits U+00A0 / U+202F as group separators; normalise for stable assertions. */
const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("country and currency metadata", () => {
  it("maps each country to its currency", () => {
    expect(currencyForCountry("GHA")).toBe("GHS");
    expect(currencyForCountry("TGO")).toBe("XOF");
    expect(currencyForCountry("BEN")).toBe("XOF");
  });

  it("exposes a flag and display name per country", () => {
    expect(COUNTRIES.GHA.displayName).toBe("Ghana");
    expect(COUNTRIES.TGO.displayName).toBe("Togo");
    expect(COUNTRIES.BEN.displayName).toBe("Bénin");
    expect(COUNTRIES.GHA.flag).toBe("🇬🇭");
  });

  it("gives XOF zero decimals and the others two", () => {
    expect(currencyDecimals("XOF")).toBe(0);
    expect(currencyDecimals("GHS")).toBe(2);
    expect(currencyDecimals("NGN")).toBe(2);
  });

  it("falls back instead of throwing on unknown wire values", () => {
    expect(parseCountryCode("ZZZ")).toBe("GHA");
    expect(parseCountryCode(undefined)).toBe("GHA");
    expect(parseCurrency("ZZZ")).toBe("GHS");
  });
});

describe("formatMoney", () => {
  it("puts the code after the amount", () => {
    expect(norm(formatMoney(50, "GHS"))).toBe("50.00 GHS");
  });

  it("formats XOF without decimals and with grouped thousands", () => {
    expect(norm(formatMoney(1200, "XOF"))).toBe("1 200 XOF");
  });

  it("can omit the code", () => {
    expect(norm(formatMoney(1200, "XOF", { withSymbol: false }))).toBe("1 200");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- currency`
Expected: FAIL — `Cannot find module './currency'`.

- [ ] **Step 3: Write the implementation**

Create `packages/kaya-core/src/money/currency.ts`:

```ts
/**
 * Country and currency metadata. Wire spellings (GHA, GHS, …) are the exact
 * strings the backend sends — they are compared verbatim, never lowercased.
 */

export const COUNTRY_CODES = ["GHA", "TGO", "BEN"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

/** NGN is display-only (v2 parking lot) but must parse if the API sends it. */
export const CURRENCIES = ["GHS", "XOF", "NGN"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface CountryMeta {
  readonly code: CountryCode;
  readonly displayName: string;
  readonly flag: string;
  readonly currency: Currency;
}

export const COUNTRIES: Record<CountryCode, CountryMeta> = {
  GHA: { code: "GHA", displayName: "Ghana", flag: "🇬🇭", currency: "GHS" },
  TGO: { code: "TGO", displayName: "Togo", flag: "🇹🇬", currency: "XOF" },
  BEN: { code: "BEN", displayName: "Bénin", flag: "🇧🇯", currency: "XOF" },
};

export function currencyForCountry(code: CountryCode): Currency {
  return COUNTRIES[code].currency;
}

/** XOF is a zero-decimal currency; GHS and NGN use two. */
export function currencyDecimals(currency: Currency): number {
  return currency === "XOF" ? 0 : 2;
}

export function parseCountryCode(value: unknown): CountryCode {
  return COUNTRY_CODES.includes(value as CountryCode)
    ? (value as CountryCode)
    : "GHA";
}

export function parseCurrency(value: unknown): Currency {
  return CURRENCIES.includes(value as Currency) ? (value as Currency) : "GHS";
}

/**
 * Formats money in the design's "amount then code" style: "50.00 GHS",
 * "1 200 XOF". XOF uses French grouping, the others US grouping — mirroring
 * the NumberFormat locales the Flutter build used.
 */
export function formatMoney(
  amount: number,
  currency: Currency,
  opts: { withSymbol?: boolean } = {},
): string {
  const decimals = currencyDecimals(currency);
  const locale = currency === "XOF" ? "fr-FR" : "en-US";
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return opts.withSymbol === false ? number : `${number} ${currency}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- currency`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/kaya-core/src/money
git commit -m "feat(core): country and currency metadata with money formatting

XOF is zero-decimal and groups in the French style, GHS and NGN keep two
decimals — same split the Flutter NumberFormat locales used. Unknown wire
values fall back to GHA/GHS rather than throwing, matching the defensive
parsing the Dart enums did.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Degressive commission

**Files:**
- Create: `packages/kaya-core/src/money/commission.ts`
- Test: `packages/kaya-core/src/money/commission.test.ts`

**Interfaces:**
- Consumes: `roundMoney` from `../money/round`.
- Produces: `commissionRateForDeliveryNumber(n: number): number`, `commissionPreview(input: { grossPrice: number; completedToday: number; litigationFee: number }): CommissionPreview` where `CommissionPreview = { grossPrice, completedToday, litigationFee, deliveryNumber, rate, ratePercent, commission, net }`.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/money/commission.test.ts`:

```ts
import { commissionPreview, commissionRateForDeliveryNumber } from "./commission";

describe("commissionRateForDeliveryNumber", () => {
  it("charges 20% for the first six deliveries of the day", () => {
    expect(commissionRateForDeliveryNumber(1)).toBe(0.2);
    expect(commissionRateForDeliveryNumber(6)).toBe(0.2);
  });

  it("charges 15% from the seventh delivery", () => {
    // Decisions log 2026-07-10: the tier follows the number of the delivery
    // being made, so the 7th of the day is already at 15%.
    expect(commissionRateForDeliveryNumber(7)).toBe(0.15);
    expect(commissionRateForDeliveryNumber(10)).toBe(0.15);
  });

  it("charges 12% from the eleventh and 9% from the fifteenth", () => {
    expect(commissionRateForDeliveryNumber(11)).toBe(0.12);
    expect(commissionRateForDeliveryNumber(14)).toBe(0.12);
    expect(commissionRateForDeliveryNumber(15)).toBe(0.09);
    expect(commissionRateForDeliveryNumber(99)).toBe(0.09);
  });
});

describe("commissionPreview", () => {
  it("bills the next delivery, not the last completed one", () => {
    const p = commissionPreview({
      grossPrice: 28,
      completedToday: 6,
      litigationFee: 1,
    });
    expect(p.deliveryNumber).toBe(7);
    expect(p.rate).toBe(0.15);
    expect(p.ratePercent).toBe(15);
    expect(p.commission).toBe(4.2);
    expect(p.net).toBe(22.8);
  });

  it("starts a fresh day at 20%", () => {
    const p = commissionPreview({
      grossPrice: 50,
      completedToday: 0,
      litigationFee: 1,
    });
    expect(p.deliveryNumber).toBe(1);
    expect(p.rate).toBe(0.2);
    expect(p.commission).toBe(10);
    expect(p.net).toBe(39);
  });

  it("applies the XOF litigation fee of 100", () => {
    const p = commissionPreview({
      grossPrice: 3000,
      completedToday: 14,
      litigationFee: 100,
    });
    expect(p.rate).toBe(0.09);
    expect(p.commission).toBe(270);
    expect(p.net).toBe(2630);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- commission`
Expected: FAIL — `Cannot find module './commission'`.

- [ ] **Step 3: Write the implementation**

Create `packages/kaya-core/src/money/commission.ts`:

```ts
import { roundMoney } from "./round";

/**
 * Degressive commission. The tier is decided by the *number of the delivery
 * being made today* (1-based), not by how many are already done — decisions log
 * 2026-07-10. The 7th delivery of the day is charged 15%. Counters reset at
 * midnight in the country's timezone, which the backend owns.
 */
export function commissionRateForDeliveryNumber(deliveryNumber: number): number {
  if (deliveryNumber >= 15) return 0.09;
  if (deliveryNumber >= 11) return 0.12;
  if (deliveryNumber >= 7) return 0.15;
  return 0.2;
}

export interface CommissionPreview {
  readonly grossPrice: number;
  readonly completedToday: number;
  readonly litigationFee: number;
  readonly deliveryNumber: number;
  readonly rate: number;
  readonly ratePercent: number;
  readonly commission: number;
  readonly net: number;
}

/**
 * Net earnings preview for a driver's proposed price. The delivery about to be
 * made is number `completedToday + 1`. `litigationFee` comes from the country's
 * config (1 GHS in Ghana, 100 XOF in Togo/Benin) and is never a constant here.
 */
export function commissionPreview(input: {
  grossPrice: number;
  completedToday: number;
  litigationFee: number;
}): CommissionPreview {
  const { grossPrice, completedToday, litigationFee } = input;
  const deliveryNumber = completedToday + 1;
  const rate = commissionRateForDeliveryNumber(deliveryNumber);
  const commission = roundMoney(grossPrice * rate);
  return {
    grossPrice,
    completedToday,
    litigationFee,
    deliveryNumber,
    rate,
    ratePercent: Math.round(rate * 100),
    commission,
    net: roundMoney(grossPrice - commission - litigationFee),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- commission`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/kaya-core/src/money
git commit -m "feat(core): degressive commission keyed on the day's delivery number

The tier follows the number of the delivery being made, so the 7th of the day
is already charged 15% — decisions log 2026-07-10. Indexing on deliveries
already completed would shift every rate by one rank. The litigation fee is an
input read from country_configs, never a constant.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire coercion and enums

**Files:**
- Create: `packages/kaya-core/src/wire/coerce.ts`, `packages/kaya-core/src/wire/enums.ts`
- Test: `packages/kaya-core/src/wire/coerce.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: from `coerce.ts` — `decimalLike(fallback?: number)`, `decimalLikeOrNull()`, `intLike(fallback?: number)`, `intLikeOrNull()`, `boolLike(fallback?: boolean)`, `stringLike(fallback?: string)`, `stringLikeOrNull()`, `dateLike()`, `dateLikeOrNull()`, `jsonMap()`, each returning a `z.ZodType`. From `enums.ts` — `userRole`, `vehicleType`, `orderStatus`, `offerStatus`, `deliveryStatus`, `clientPaymentStatus`, `transactionType`, `withdrawalMethod`, `withdrawalStatus`, `notificationType`, each a `z.ZodType` with a documented fallback, plus the matching TypeScript union types (`UserRole`, `OrderStatus`, …).

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/wire/coerce.test.ts`:

```ts
import { z } from "zod";
import {
  boolLike,
  dateLike,
  decimalLike,
  decimalLikeOrNull,
  intLike,
  jsonMap,
  stringLikeOrNull,
} from "./coerce";
import { orderStatus, userRole, vehicleType } from "./enums";

describe("decimalLike", () => {
  it("accepts the strings Prisma Decimal serialises to", () => {
    expect(decimalLike().parse("50.00")).toBe(50);
    expect(decimalLike().parse(50)).toBe(50);
  });

  it("falls back on null, undefined and garbage", () => {
    expect(decimalLike().parse(null)).toBe(0);
    expect(decimalLike().parse(undefined)).toBe(0);
    expect(decimalLike().parse("abc")).toBe(0);
    expect(decimalLike(5).parse(null)).toBe(5);
  });

  it("keeps null distinguishable when the field is optional", () => {
    expect(decimalLikeOrNull().parse(null)).toBeNull();
    expect(decimalLikeOrNull().parse("2.5")).toBe(2.5);
  });
});

describe("intLike and boolLike", () => {
  it("coerces numeric strings and floats to int", () => {
    expect(intLike().parse("7")).toBe(7);
    expect(intLike().parse(7.9)).toBe(7);
    expect(intLike(5).parse(null)).toBe(5);
  });

  it("coerces truthy wire shapes to bool", () => {
    expect(boolLike().parse(true)).toBe(true);
    expect(boolLike().parse("true")).toBe(true);
    expect(boolLike().parse("TRUE")).toBe(true);
    expect(boolLike().parse(1)).toBe(true);
    expect(boolLike().parse(0)).toBe(false);
    expect(boolLike(true).parse(null)).toBe(true);
  });
});

describe("dateLike", () => {
  it("parses ISO strings", () => {
    expect(dateLike().parse("2026-08-02T10:00:00.000Z").toISOString()).toBe(
      "2026-08-02T10:00:00.000Z",
    );
  });

  it("returns null for absent optional dates", () => {
    expect(stringLikeOrNull().parse(null)).toBeNull();
  });
});

describe("jsonMap", () => {
  it("returns an object or an empty one", () => {
    expect(jsonMap().parse({ a: 1 })).toEqual({ a: 1 });
    expect(jsonMap().parse(null)).toEqual({});
    expect(jsonMap().parse("nope")).toEqual({});
  });
});

describe("wire enums", () => {
  it("passes known snake_case values through", () => {
    expect(orderStatus.parse("offers_received")).toBe("offers_received");
    expect(userRole.parse("livreur")).toBe("livreur");
  });

  it("falls back on unknown values instead of throwing", () => {
    expect(orderStatus.parse("teleported")).toBe("draft");
    expect(userRole.parse(undefined)).toBe("client");
  });

  it("leaves genuinely optional enums null", () => {
    expect(vehicleType.parse(null)).toBeNull();
    expect(vehicleType.parse("moto")).toBe("moto");
  });

  it("is assignable to the exported union type", () => {
    const s: z.infer<typeof orderStatus> = "delivered";
    expect(s).toBe("delivered");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- wire`
Expected: FAIL — `Cannot find module './coerce'`.

- [ ] **Step 3: Write the coercion helpers**

Create `packages/kaya-core/src/wire/coerce.ts`:

```ts
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
```

- [ ] **Step 4: Write the wire enums**

Create `packages/kaya-core/src/wire/enums.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- wire`
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/kaya-core/src/wire
git commit -m "feat(core): wire coercion helpers and fallback enums

Prisma Decimal fields serialise as JSON strings, so every money helper accepts
string or number. Enums keep the backend's snake_case spelling and fall back to
a documented default instead of throwing, matching the Dart parsers.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Core models — geo, user, country config, price quote

**Files:**
- Create: `packages/kaya-core/src/models/geo.ts`, `user.ts`, `countryConfig.ts`, `priceQuote.ts`
- Test: `packages/kaya-core/src/models/user.test.ts`, `packages/kaya-core/src/models/countryConfig.test.ts`

**Interfaces:**
- Consumes: `decimalLike`, `decimalLikeOrNull`, `intLike`, `intLikeOrNull`, `boolLike`, `stringLike`, `stringLikeOrNull` from `../wire/coerce`; `userRole`, `vehicleType` from `../wire/enums`; `parseCountryCode`, `parseCurrency`, `currencyForCountry` from `../money/currency`.
- Produces: `geoPointSchema`/`GeoPoint`, `userSchema`/`User`, `isDriver(u: User): boolean`, `isClient(u: User): boolean`, `userCurrency(u: User): Currency`, `countryConfigSchema`/`CountryConfig`, `priceQuoteSchema`/`PriceQuote`.

- [ ] **Step 1: Write the failing tests**

Create `packages/kaya-core/src/models/user.test.ts`:

```ts
import { isClient, isDriver, userCurrency, userSchema } from "./user";

const raw = {
  id: "u1",
  email: "ama@example.com",
  phone: "+233201234567",
  fullName: "Ama Owusu",
  role: "livreur",
  countryCode: "TGO",
  isVerified: true,
  ratingDriver: "4.80",
  balance: "1200.00",
  dailyDeliveries: "6",
  vehicleType: "moto",
};

describe("userSchema", () => {
  it("parses a driver, coercing Decimal strings", () => {
    const u = userSchema.parse(raw);
    expect(u.fullName).toBe("Ama Owusu");
    expect(u.ratingDriver).toBe(4.8);
    expect(u.balance).toBe(1200);
    expect(u.dailyDeliveries).toBe(6);
    expect(u.vehicleType).toBe("moto");
  });

  it("applies the documented defaults for absent fields", () => {
    const u = userSchema.parse({ id: "u2" });
    expect(u.role).toBe("client");
    expect(u.countryCode).toBe("GHA");
    expect(u.isActive).toBe(true);
    expect(u.isVerified).toBe(false);
    expect(u.isOnline).toBe(false);
    expect(u.ratingDriver).toBe(5);
    expect(u.ratingClient).toBe(5);
    expect(u.totalDeliveries).toBe(0);
    expect(u.balance).toBe(0);
    expect(u.vehicleType).toBeNull();
  });

  it("derives role predicates and currency", () => {
    const driver = userSchema.parse(raw);
    expect(isDriver(driver)).toBe(true);
    expect(isClient(driver)).toBe(false);
    expect(userCurrency(driver)).toBe("XOF");

    const both = userSchema.parse({ ...raw, role: "both", countryCode: "GHA" });
    expect(isDriver(both)).toBe(true);
    expect(isClient(both)).toBe(true);
    expect(userCurrency(both)).toBe("GHS");
  });
});
```

Create `packages/kaya-core/src/models/countryConfig.test.ts`:

```ts
import { countryConfigSchema } from "./countryConfig";
import { priceQuoteSchema } from "./priceQuote";

describe("countryConfigSchema", () => {
  it("collapses the four tier columns into an ordered array", () => {
    const c = countryConfigSchema.parse({
      countryCode: "TGO",
      countryName: "Togo",
      currencyCode: "XOF",
      currencySymbol: "XOF",
      pricePerKm: "150",
      basePickupFee: "300",
      commissionTier1: "0.20",
      commissionTier2: "0.15",
      commissionTier3: "0.12",
      commissionTier4: "0.09",
      litigationFee: "100",
      searchRadiusKm: 5,
      withdrawalMethods: ["momo", "bank_transfer"],
      momoProviders: ["Moov", "Togocom"],
    });
    expect(c.commissionTiers).toEqual([0.2, 0.15, 0.12, 0.09]);
    expect(c.currency).toBe("XOF");
    expect(c.pricePerKm).toBe(150);
    expect(c.litigationFee).toBe(100);
    expect(c.momoProviders).toEqual(["Moov", "Togocom"]);
  });

  it("uses documented defaults when tiers and lists are missing", () => {
    const c = countryConfigSchema.parse({ countryCode: "GHA" });
    expect(c.commissionTiers).toEqual([0.2, 0.15, 0.12, 0.09]);
    expect(c.litigationFee).toBe(1);
    expect(c.searchRadiusKm).toBe(5);
    expect(c.withdrawalMethods).toEqual([]);
  });
});

describe("priceQuoteSchema", () => {
  it("parses the calculate-price response", () => {
    const q = priceQuoteSchema.parse({
      countryCode: "GHA",
      distanceKm: "6.2",
      minPrice: "24.00",
      currency: "GHS",
      currencySymbol: "GHS",
      pricePerKm: "1",
      basePickupFee: "2",
      durationMin: "18",
      source: "haversine",
    });
    expect(q.distanceKm).toBe(6.2);
    expect(q.minPrice).toBe(24);
    expect(q.durationMin).toBe(18);
    expect(q.source).toBe("haversine");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @kaya/core -- models`
Expected: FAIL — `Cannot find module './user'`.

- [ ] **Step 3: Write `geo.ts`**

Create `packages/kaya-core/src/models/geo.ts`:

```ts
import { z } from "zod";
import { decimalLike } from "../wire/coerce";

export const geoPointSchema = z.object({
  lat: decimalLike(),
  lng: decimalLike(),
});

export type GeoPoint = z.infer<typeof geoPointSchema>;

export const geoPointsEqual = (a: GeoPoint, b: GeoPoint): boolean =>
  a.lat === b.lat && a.lng === b.lng;
```

- [ ] **Step 4: Write `user.ts`**

Create `packages/kaya-core/src/models/user.ts`:

```ts
import { z } from "zod";
import { type Currency, currencyForCountry, parseCountryCode } from "../money/currency";
import {
  boolLike,
  decimalLike,
  intLike,
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
  age: z.unknown().transform((v) => (v === null || v === undefined ? null : Number(v) || null)),
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
```

- [ ] **Step 5: Write `countryConfig.ts`**

Create `packages/kaya-core/src/models/countryConfig.ts`:

```ts
import { z } from "zod";
import { parseCountryCode, parseCurrency } from "../money/currency";
import { decimalLike, intLike, stringLike } from "../wire/coerce";

const stringList = () =>
  z.unknown().transform((v) => (Array.isArray(v) ? v.map(String) : []));

/**
 * Per-country pricing and commission configuration (backend `country_configs`).
 * The four tier columns are collapsed into an ordered array so callers never
 * index a column name.
 */
export const countryConfigSchema = z
  .object({
    countryCode: z.unknown().transform(parseCountryCode),
    countryName: stringLike(),
    currencyCode: z.unknown(),
    currencySymbol: stringLike(),
    pricePerKm: decimalLike(0),
    basePickupFee: decimalLike(0),
    commissionTier1: decimalLike(0.2),
    commissionTier2: decimalLike(0.15),
    commissionTier3: decimalLike(0.12),
    commissionTier4: decimalLike(0.09),
    litigationFee: decimalLike(1),
    searchRadiusKm: intLike(5),
    withdrawalMethods: stringList(),
    momoProviders: stringList(),
  })
  .transform((c) => ({
    countryCode: c.countryCode,
    countryName: c.countryName,
    currency: parseCurrency(c.currencyCode),
    currencySymbol: c.currencySymbol,
    pricePerKm: c.pricePerKm,
    basePickupFee: c.basePickupFee,
    /** [tier1, tier2, tier3, tier4] as fractions. */
    commissionTiers: [
      c.commissionTier1,
      c.commissionTier2,
      c.commissionTier3,
      c.commissionTier4,
    ] as const,
    litigationFee: c.litigationFee,
    searchRadiusKm: c.searchRadiusKm,
    withdrawalMethods: c.withdrawalMethods,
    momoProviders: c.momoProviders,
  }));

export type CountryConfig = z.infer<typeof countryConfigSchema>;
```

- [ ] **Step 6: Write `priceQuote.ts`**

Create `packages/kaya-core/src/models/priceQuote.ts`:

```ts
import { z } from "zod";
import { parseCountryCode, parseCurrency } from "../money/currency";
import { decimalLike, intLikeOrNull, stringLike, stringLikeOrNull } from "../wire/coerce";

/** Result of GET /calculate-price (distance plus minimum suggested price). */
export const priceQuoteSchema = z.object({
  countryCode: z.unknown().transform(parseCountryCode),
  distanceKm: decimalLike(0),
  minPrice: decimalLike(0),
  currency: z.unknown().transform(parseCurrency),
  currencySymbol: stringLike(),
  pricePerKm: decimalLike(0),
  basePickupFee: decimalLike(0),
  durationMin: intLikeOrNull(),
  source: stringLikeOrNull(),
});

export type PriceQuote = z.infer<typeof priceQuoteSchema>;
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w @kaya/core -- models`
Expected: PASS, 6 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/kaya-core/src/models
git commit -m "feat(core): user, country config, price quote and geo schemas

Country config collapses the four commissionTier columns into an ordered array
so callers never index a column name. Ratings default to 5 and isActive to true,
matching the Dart constructors.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Order, offer and delivery models

**Files:**
- Create: `packages/kaya-core/src/models/order.ts`, `offer.ts`, `delivery.ts`
- Test: `packages/kaya-core/src/models/delivery.test.ts`

**Interfaces:**
- Consumes: `geoPointSchema` (Task 5), `userSchema` (Task 5), the coercion helpers and `orderStatus`/`offerStatus`/`deliveryStatus`/`clientPaymentStatus` (Task 4).
- Produces: `orderSchema`/`Order`, `isScheduled(o: Order): boolean`, `isLive(o: Order): boolean`, `offerSchema`/`Offer`, `deliverySchema`/`Delivery`, `timelineStep(d: Delivery): 0 | 1 | 2 | 3`.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/models/delivery.test.ts`:

```ts
import { deliverySchema, timelineStep } from "./delivery";
import { isLive, isScheduled, orderSchema } from "./order";
import { offerSchema } from "./offer";

describe("orderSchema", () => {
  it("folds the flat lat/lng columns into geo points", () => {
    const o = orderSchema.parse({
      id: "o1",
      clientId: "c1",
      pickupAddress: "Oxford Street, Osu",
      pickupLat: "5.5560",
      pickupLng: "-0.1969",
      deliveryAddress: "14 Mango Lane, East Legon",
      deliveryLat: "5.6350",
      deliveryLng: "-0.1660",
      status: "published",
      minPriceSuggested: "24.00",
      distanceKm: "6.2",
      createdAt: "2026-08-02T10:00:00.000Z",
    });
    expect(o.pickup).toEqual({ lat: 5.556, lng: -0.1969 });
    expect(o.dropoff).toEqual({ lat: 5.635, lng: -0.166 });
    expect(o.minPriceSuggested).toBe(24);
    expect(isLive(o)).toBe(true);
    expect(isScheduled(o)).toBe(false);
  });

  it("marks an order with a scheduledTime as scheduled", () => {
    const o = orderSchema.parse({
      id: "o2",
      status: "draft",
      scheduledTime: "2026-08-03T08:00:00.000Z",
    });
    expect(isScheduled(o)).toBe(true);
    expect(isLive(o)).toBe(false);
  });
});

describe("offerSchema", () => {
  it("parses the embedded livreur relation when present", () => {
    const o = offerSchema.parse({
      id: "of1",
      orderId: "o1",
      livreurId: "u1",
      proposedPrice: "28.00",
      minPrice: "24.00",
      status: "pending",
      createdAt: "2026-08-02T10:05:00.000Z",
      livreur: { id: "u1", fullName: "Kwame Mensah", role: "livreur" },
    });
    expect(o.proposedPrice).toBe(28);
    expect(o.driver?.fullName).toBe("Kwame Mensah");
  });

  it("leaves driver null when the relation is absent", () => {
    const o = offerSchema.parse({ id: "of2", orderId: "o1", livreurId: "u2" });
    expect(o.driver).toBeNull();
    expect(o.status).toBe("pending");
  });
});

describe("timelineStep", () => {
  const base = {
    id: "d1",
    orderId: "o1",
    livreurId: "u1",
    status: "in_progress",
    clientPaymentStatus: "escrow_held",
    createdAt: "2026-08-02T10:00:00.000Z",
  };

  it("is 0 before pickup", () => {
    expect(timelineStep(deliverySchema.parse(base))).toBe(0);
  });

  it("is 1 once picked up", () => {
    const d = deliverySchema.parse({ ...base, pickupTime: "2026-08-02T10:20:00.000Z" });
    expect(timelineStep(d)).toBe(1);
  });

  it("is 2 once the embedded order says in_transit", () => {
    const d = deliverySchema.parse({
      ...base,
      pickupTime: "2026-08-02T10:20:00.000Z",
      order: { id: "o1", status: "in_transit" },
    });
    expect(timelineStep(d)).toBe(2);
  });

  it("is 3 once delivered or completed", () => {
    const byTime = deliverySchema.parse({
      ...base,
      deliveryTime: "2026-08-02T10:45:00.000Z",
    });
    const byStatus = deliverySchema.parse({ ...base, status: "completed" });
    expect(timelineStep(byTime)).toBe(3);
    expect(timelineStep(byStatus)).toBe(3);
  });

  it("defaults the litigation fee to 1", () => {
    expect(deliverySchema.parse(base).litigationFee).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- delivery`
Expected: FAIL — `Cannot find module './delivery'`.

- [ ] **Step 3: Write `order.ts`**

Create `packages/kaya-core/src/models/order.ts`:

```ts
import { z } from "zod";
import {
  dateLike,
  dateLikeOrNull,
  decimalLike,
  decimalLikeOrNull,
  stringLike,
  stringLikeOrNull,
} from "../wire/coerce";
import { orderStatus } from "../wire/enums";
import type { GeoPoint } from "./geo";

/**
 * A delivery order created by a client. Mirrors backend `orders`, whose
 * coordinates arrive as four flat columns and are folded into geo points here.
 */
export const orderSchema = z
  .object({
    id: stringLike(),
    clientId: stringLike(),
    pickupAddress: stringLike(),
    pickupLat: decimalLike(),
    pickupLng: decimalLike(),
    deliveryAddress: stringLike(),
    deliveryLat: decimalLike(),
    deliveryLng: decimalLike(),
    status: orderStatus,
    description: stringLikeOrNull(),
    packagePhoto: stringLikeOrNull(),
    weightKg: decimalLikeOrNull(),
    dimensions: stringLikeOrNull(),
    scheduledTime: dateLikeOrNull(),
    publishedAt: dateLikeOrNull(),
    minPriceSuggested: decimalLikeOrNull(),
    distanceKm: decimalLikeOrNull(),
    acceptedOfferId: stringLikeOrNull(),
    createdAt: dateLike(),
  })
  .transform((o) => {
    const pickup: GeoPoint = { lat: o.pickupLat, lng: o.pickupLng };
    const dropoff: GeoPoint = { lat: o.deliveryLat, lng: o.deliveryLng };
    return {
      id: o.id,
      clientId: o.clientId,
      pickupAddress: o.pickupAddress,
      pickup,
      deliveryAddress: o.deliveryAddress,
      dropoff,
      status: o.status,
      description: o.description,
      packagePhoto: o.packagePhoto,
      weightKg: o.weightKg,
      dimensions: o.dimensions,
      scheduledTime: o.scheduledTime,
      publishedAt: o.publishedAt,
      minPriceSuggested: o.minPriceSuggested,
      distanceKm: o.distanceKm,
      acceptedOfferId: o.acceptedOfferId,
      createdAt: o.createdAt,
    };
  });

export type Order = z.infer<typeof orderSchema>;

export const isScheduled = (o: Order): boolean => o.scheduledTime !== null;

export const isLive = (o: Order): boolean =>
  o.status === "published" || o.status === "offers_received";
```

- [ ] **Step 4: Write `offer.ts`**

Create `packages/kaya-core/src/models/offer.ts`:

```ts
import { z } from "zod";
import { dateLike, dateLikeOrNull, decimalLike, stringLike } from "../wire/coerce";
import { offerStatus } from "../wire/enums";
import { userSchema } from "./user";

/**
 * A driver's price bid on an order. Mirrors backend `offers`; the bidding driver
 * is embedded under `livreur` when the API includes the relation.
 */
export const offerSchema = z
  .object({
    id: stringLike(),
    orderId: stringLike(),
    livreurId: stringLike(),
    proposedPrice: decimalLike(),
    minPrice: decimalLike(),
    status: offerStatus,
    createdAt: dateLike(),
    expiresAt: dateLikeOrNull(),
    livreur: z.unknown(),
  })
  .transform((o) => ({
    id: o.id,
    orderId: o.orderId,
    livreurId: o.livreurId,
    proposedPrice: o.proposedPrice,
    minPrice: o.minPrice,
    status: o.status,
    createdAt: o.createdAt,
    expiresAt: o.expiresAt,
    driver:
      o.livreur !== null && typeof o.livreur === "object"
        ? userSchema.parse(o.livreur)
        : null,
  }));

export type Offer = z.infer<typeof offerSchema>;
```

- [ ] **Step 5: Write `delivery.ts`**

Create `packages/kaya-core/src/models/delivery.ts`:

```ts
import { z } from "zod";
import {
  dateLike,
  dateLikeOrNull,
  decimalLike,
  decimalLikeOrNull,
  stringLike,
  stringLikeOrNull,
} from "../wire/coerce";
import { clientPaymentStatus, deliveryStatus } from "../wire/enums";
import { orderSchema } from "./order";
import { userSchema } from "./user";

/**
 * An accepted order in execution. Mirrors backend `deliveries`, with optional
 * embedded `order` and `livreur` relations.
 */
export const deliverySchema = z
  .object({
    id: stringLike(),
    orderId: stringLike(),
    livreurId: stringLike(),
    status: deliveryStatus,
    clientPaymentStatus,
    pickupPhoto: stringLikeOrNull(),
    deliveryPhoto: stringLikeOrNull(),
    startTime: dateLikeOrNull(),
    pickupTime: dateLikeOrNull(),
    deliveryTime: dateLikeOrNull(),
    deliveryConfirmedAt: dateLikeOrNull(),
    distanceKm: decimalLikeOrNull(),
    basePrice: decimalLikeOrNull(),
    commissionRate: decimalLikeOrNull(),
    commissionAmount: decimalLikeOrNull(),
    litigationFee: decimalLike(1),
    netEarnings: decimalLikeOrNull(),
    createdAt: dateLike(),
    order: z.unknown(),
    livreur: z.unknown(),
  })
  .transform((d) => ({
    id: d.id,
    orderId: d.orderId,
    livreurId: d.livreurId,
    status: d.status,
    clientPaymentStatus: d.clientPaymentStatus,
    pickupPhoto: d.pickupPhoto,
    deliveryPhoto: d.deliveryPhoto,
    startTime: d.startTime,
    pickupTime: d.pickupTime,
    deliveryTime: d.deliveryTime,
    deliveryConfirmedAt: d.deliveryConfirmedAt,
    distanceKm: d.distanceKm,
    basePrice: d.basePrice,
    commissionRate: d.commissionRate,
    commissionAmount: d.commissionAmount,
    litigationFee: d.litigationFee,
    netEarnings: d.netEarnings,
    createdAt: d.createdAt,
    order:
      d.order !== null && typeof d.order === "object"
        ? orderSchema.parse(d.order)
        : null,
    driver:
      d.livreur !== null && typeof d.livreur === "object"
        ? userSchema.parse(d.livreur)
        : null,
  }));

export type Delivery = z.infer<typeof deliverySchema>;

/**
 * Maps the delivery lifecycle onto the 4-step tracking timeline.
 * 0 = en route, 1 = picked up, 2 = in transit, 3 = delivered.
 */
export function timelineStep(d: Delivery): 0 | 1 | 2 | 3 {
  if (d.deliveryTime !== null || d.status === "completed") return 3;
  if (d.pickupTime !== null) {
    return d.order?.status === "in_transit" ? 2 : 1;
  }
  return 0;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- delivery`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/kaya-core/src/models
git commit -m "feat(core): order, offer and delivery schemas with the tracking timeline

Orders fold the four flat lat/lng columns into pickup and dropoff geo points.
timelineStep reproduces the Dart mapping onto the 4-step tracking UI, including
the transit refinement that reads the embedded order status.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Remaining models — message, rating, transaction, withdrawal, notification, auth

**Files:**
- Create: `packages/kaya-core/src/models/message.ts`, `rating.ts`, `transaction.ts`, `withdrawal.ts`, `notification.ts`, `auth.ts`
- Test: `packages/kaya-core/src/models/auth.test.ts`, `packages/kaya-core/src/models/withdrawal.test.ts`

**Interfaces:**
- Consumes: coercion helpers and enums (Task 4), `userSchema` (Task 5), `parseCurrency` (Task 2).
- Produces: `messageSchema`/`Message`, `hasImage(m: Message): boolean`, `ratingSchema`/`Rating`, `ratingSummarySchema`/`RatingSummary`, `transactionSchema`/`Transaction`, `isCredit(t: Transaction): boolean`, `withdrawalSchema`/`Withdrawal`, `withdrawalNetAmount(w: Withdrawal): number`, `appNotificationSchema`/`AppNotification`, `isRead(n: AppNotification): boolean`, `authTokensSchema`/`AuthTokens`, `authResultSchema`/`AuthResult`, `loginChallengeSchema`/`LoginChallenge`, `parseSocialLoginOutcome(raw: unknown): SocialLoginOutcome`.

- [ ] **Step 1: Write the failing tests**

Create `packages/kaya-core/src/models/auth.test.ts`:

```ts
import { authResultSchema, authTokensSchema, parseSocialLoginOutcome } from "./auth";

describe("authTokensSchema", () => {
  it("accepts camelCase keys", () => {
    const t = authTokensSchema.parse({ accessToken: "a", refreshToken: "r" });
    expect(t).toEqual({ accessToken: "a", refreshToken: "r" });
  });

  it("accepts snake_case keys as a fallback", () => {
    const t = authTokensSchema.parse({ access_token: "a", refresh_token: "r" });
    expect(t).toEqual({ accessToken: "a", refreshToken: "r" });
  });
});

describe("authResultSchema", () => {
  it("parses tokens with an embedded user", () => {
    const r = authResultSchema.parse({
      accessToken: "a",
      refreshToken: "r",
      user: { id: "u1", fullName: "Ama", role: "client" },
    });
    expect(r.tokens.accessToken).toBe("a");
    expect(r.user?.fullName).toBe("Ama");
  });

  it("leaves user null when absent", () => {
    expect(authResultSchema.parse({ accessToken: "a", refreshToken: "r" }).user).toBeNull();
  });
});

describe("parseSocialLoginOutcome", () => {
  it("routes a brand new email into the registration wizard", () => {
    const out = parseSocialLoginOutcome({
      isNewAccount: true,
      socialDraftToken: "tok",
      email: "new@example.com",
      fullName: "New User",
    });
    expect(out.kind).toBe("signup_required");
    if (out.kind === "signup_required") {
      expect(out.socialDraftToken).toBe("tok");
      expect(out.email).toBe("new@example.com");
      expect(out.fullName).toBe("New User");
    }
  });

  it("logs an existing account straight in", () => {
    const out = parseSocialLoginOutcome({ accessToken: "a", refreshToken: "r" });
    expect(out.kind).toBe("success");
    if (out.kind === "success") {
      expect(out.result.tokens.refreshToken).toBe("r");
    }
  });
});
```

Create `packages/kaya-core/src/models/withdrawal.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @kaya/core -- "auth|withdrawal"`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 3: Write `message.ts`, `rating.ts`, `notification.ts`**

Create `packages/kaya-core/src/models/message.ts`:

```ts
import { z } from "zod";
import { boolLike, dateLike, stringLike, stringLikeOrNull } from "../wire/coerce";

/** A chat message scoped to a delivery. Mirrors backend `messages`. */
export const messageSchema = z.object({
  id: stringLike(),
  deliveryId: stringLike(),
  senderId: stringLike(),
  receiverId: stringLikeOrNull(),
  messageText: stringLikeOrNull(),
  imageUrl: stringLikeOrNull(),
  isRead: boolLike(false),
  createdAt: dateLike(),
});

export type Message = z.infer<typeof messageSchema>;

export const hasImage = (m: Message): boolean =>
  m.imageUrl !== null && m.imageUrl.length > 0;
```

Create `packages/kaya-core/src/models/rating.ts`:

```ts
import { z } from "zod";
import { dateLike, decimalLike, intLike, stringLike, stringLikeOrNull } from "../wire/coerce";

/** A 1–5 rating, unique per (delivery, author). Mirrors backend `ratings`. */
export const ratingSchema = z.object({
  id: stringLike(),
  deliveryId: stringLike(),
  fromUserId: stringLike(),
  toUserId: stringLike(),
  score: intLike(0),
  comment: stringLikeOrNull(),
  createdAt: dateLike(),
});

export type Rating = z.infer<typeof ratingSchema>;

export const ratingSummarySchema = z.object({
  average: decimalLike(0),
  count: intLike(0),
  ratings: z
    .unknown()
    .transform((v) => (Array.isArray(v) ? v.map((r) => ratingSchema.parse(r)) : [])),
});

export type RatingSummary = z.infer<typeof ratingSummarySchema>;
```

Create `packages/kaya-core/src/models/notification.ts`:

```ts
import { z } from "zod";
import { dateLike, dateLikeOrNull, jsonMap, stringLike } from "../wire/coerce";
import { notificationType } from "../wire/enums";

/** An in-app notification row. Mirrors backend `notifications`. */
export const appNotificationSchema = z.object({
  id: stringLike(),
  type: notificationType,
  title: stringLike(),
  body: stringLike(),
  data: jsonMap(),
  readAt: dateLikeOrNull(),
  createdAt: dateLike(),
});

export type AppNotification = z.infer<typeof appNotificationSchema>;

export const isRead = (n: AppNotification): boolean => n.readAt !== null;
```

- [ ] **Step 4: Write `transaction.ts` and `withdrawal.ts`**

Create `packages/kaya-core/src/models/transaction.ts`:

```ts
import { z } from "zod";
import { parseCurrency } from "../money/currency";
import { dateLike, decimalLike, stringLike, stringLikeOrNull } from "../wire/coerce";
import { type TransactionType, transactionType } from "../wire/enums";

/** An append-only ledger row. Mirrors backend `transactions`. */
export const transactionSchema = z.object({
  id: stringLike(),
  userId: stringLike(),
  deliveryId: stringLikeOrNull(),
  type: transactionType,
  amount: decimalLike(0),
  currency: z.unknown().transform(parseCurrency),
  status: stringLike(),
  reference: stringLikeOrNull(),
  createdAt: dateLike(),
});

export type Transaction = z.infer<typeof transactionSchema>;

/** Types that increase the user's balance; everything else reduces it. */
const CREDIT_TYPES: readonly TransactionType[] = [
  "payment_in",
  "escrow_release",
  "driver_payout",
  "refund",
];

export const isCredit = (t: Transaction): boolean => CREDIT_TYPES.includes(t.type);
```

Create `packages/kaya-core/src/models/withdrawal.ts`:

```ts
import { z } from "zod";
import { dateLike, dateLikeOrNull, decimalLike, jsonMap, stringLike, stringLikeOrNull } from "../wire/coerce";
import { withdrawalMethod, withdrawalStatus } from "../wire/enums";
import { roundMoney } from "../money/round";

/**
 * A payout request. Mirrors backend `withdrawals`; `accountDetails` is an
 * opaque JSONB map whose shape depends on the method and country.
 */
export const withdrawalSchema = z.object({
  id: stringLike(),
  livreurId: stringLike(),
  amount: decimalLike(0),
  method: withdrawalMethod,
  status: withdrawalStatus,
  feeAmount: decimalLike(0),
  accountDetails: jsonMap(),
  requestedAt: dateLike(),
  processedAt: dateLikeOrNull(),
  rejectionReason: stringLikeOrNull(),
});

export type Withdrawal = z.infer<typeof withdrawalSchema>;

export const withdrawalNetAmount = (w: Withdrawal): number =>
  roundMoney(w.amount - w.feeAmount);
```

- [ ] **Step 5: Write `auth.ts`**

Create `packages/kaya-core/src/models/auth.ts`:

```ts
import { z } from "zod";
import { stringLike, stringLikeOrNull } from "../wire/coerce";
import { type User, userSchema } from "./user";

/**
 * Token pair returned by login, register and refresh. The backend has used both
 * camelCase and snake_case spellings, so accept either.
 */
export const authTokensSchema = z
  .object({
    accessToken: z.unknown(),
    refreshToken: z.unknown(),
    access_token: z.unknown(),
    refresh_token: z.unknown(),
  })
  .transform((t) => ({
    accessToken: String(t.accessToken ?? t.access_token ?? ""),
    refreshToken: String(t.refreshToken ?? t.refresh_token ?? ""),
  }));

export type AuthTokens = z.infer<typeof authTokensSchema>;

/** Login/register response: tokens plus, optionally, the user profile. */
export const authResultSchema = z
  .object({ user: z.unknown() })
  .passthrough()
  .transform((raw) => ({
    tokens: authTokensSchema.parse(raw),
    user:
      raw.user !== null && typeof raw.user === "object"
        ? userSchema.parse(raw.user)
        : null,
  }));

export type AuthResult = { tokens: AuthTokens; user: User | null };

/** Response to POST /auth/login: a redeemable 2FA challenge, not tokens. */
export const loginChallengeSchema = z.object({ challengeId: stringLike() });

export type LoginChallenge = z.infer<typeof loginChallengeSchema>;

/**
 * Response to POST /auth/social. Either an existing account logs straight in,
 * or the email has no user row yet and the app must route into the registration
 * wizard with name and email prefilled and locked.
 */
export type SocialLoginOutcome =
  | { kind: "success"; result: AuthResult }
  | {
      kind: "signup_required";
      socialDraftToken: string;
      email: string;
      fullName: string | null;
    };

const socialSignupSchema = z.object({
  socialDraftToken: stringLike(),
  email: stringLike(),
  fullName: stringLikeOrNull(),
});

export function parseSocialLoginOutcome(raw: unknown): SocialLoginOutcome {
  const isNew =
    raw !== null &&
    typeof raw === "object" &&
    (raw as Record<string, unknown>).isNewAccount === true;

  if (isNew) {
    return { kind: "signup_required", ...socialSignupSchema.parse(raw) };
  }
  return { kind: "success", result: authResultSchema.parse(raw) };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w @kaya/core -- "auth|withdrawal"`
Expected: PASS, 9 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/kaya-core/src/models
git commit -m "feat(core): message, rating, transaction, withdrawal, notification and auth schemas

Auth tokens accept both camelCase and snake_case spellings. The social login
response is a discriminated union: an existing account logs straight in, a new
email routes into the registration wizard with a draft token.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Typed API failures

**Files:**
- Create: `packages/kaya-core/src/errors/apiFailure.ts`
- Test: `packages/kaya-core/src/errors/apiFailure.test.ts`

**Interfaces:**
- Consumes: `axios` (for `isAxiosError`).
- Produces: `type FailureKind`, `class ApiFailure extends Error` with `kind`, `statusCode`, `fieldErrors`, and getter `isAuth`; `toApiFailure(error: unknown): ApiFailure`.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/errors/apiFailure.test.ts`:

```ts
import { AxiosError, AxiosHeaders } from "axios";
import { ApiFailure, toApiFailure } from "./apiFailure";

const httpError = (status: number, data: unknown) => {
  const err = new AxiosError("Request failed");
  err.response = {
    status,
    statusText: "",
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return err;
};

describe("toApiFailure", () => {
  it("passes an ApiFailure through unchanged", () => {
    const f = new ApiFailure({ kind: "server", message: "boom" });
    expect(toApiFailure(f)).toBe(f);
  });

  it("maps status codes to kinds", () => {
    expect(toApiFailure(httpError(401, {})).kind).toBe("unauthorized");
    expect(toApiFailure(httpError(403, {})).kind).toBe("forbidden");
    expect(toApiFailure(httpError(404, {})).kind).toBe("notFound");
    expect(toApiFailure(httpError(409, {})).kind).toBe("conflict");
    expect(toApiFailure(httpError(400, {})).kind).toBe("validation");
    expect(toApiFailure(httpError(422, {})).kind).toBe("validation");
    expect(toApiFailure(httpError(503, {})).kind).toBe("server");
    expect(toApiFailure(httpError(418, {})).kind).toBe("unknown");
  });

  it("flags unauthorized via isAuth", () => {
    expect(toApiFailure(httpError(401, {})).isAuth).toBe(true);
    expect(toApiFailure(httpError(404, {})).isAuth).toBe(false);
  });

  it("prefers the server message over the default", () => {
    const f = toApiFailure(httpError(409, { message: "Offer already accepted" }));
    expect(f.message).toBe("Offer already accepted");
  });

  it("takes the first entry when class-validator returns an array", () => {
    const f = toApiFailure(
      httpError(400, { message: ["phone must be a valid phone number", "age must be an int"] }),
    );
    expect(f.message).toBe("phone must be a valid phone number");
    expect(f.fieldErrors).toEqual({
      _: ["phone must be a valid phone number", "age must be an int"],
    });
  });

  it("falls back to a default message per kind", () => {
    expect(toApiFailure(httpError(500, {})).message).toBe(
      "Something went wrong on our side. Try again shortly.",
    );
  });

  it("maps transport failures without a response", () => {
    const timeout = new AxiosError("timeout", "ECONNABORTED");
    expect(toApiFailure(timeout).kind).toBe("timeout");

    const offline = new AxiosError("Network Error", "ERR_NETWORK");
    expect(toApiFailure(offline).kind).toBe("network");

    const cancelled = new AxiosError("canceled", "ERR_CANCELED");
    expect(toApiFailure(cancelled).kind).toBe("cancelled");
  });

  it("wraps non-axios throwables", () => {
    const f = toApiFailure(new Error("kaboom"));
    expect(f.kind).toBe("unknown");
    expect(f.message).toBe("kaboom");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- apiFailure`
Expected: FAIL — `Cannot find module './apiFailure'`.

- [ ] **Step 3: Write the implementation**

Create `packages/kaya-core/src/errors/apiFailure.ts`:

```ts
import { isAxiosError } from "axios";

/**
 * Typed failure surfaced to the UI. Screens react on `kind` rather than status
 * codes, so an unauthorized failure can trigger a re-login prompt without every
 * caller knowing about HTTP.
 */
export type FailureKind =
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "validation"
  | "server"
  | "cancelled"
  | "unknown";

export class ApiFailure extends Error {
  readonly kind: FailureKind;
  readonly statusCode: number | null;
  /** Field-level messages from class-validator (`{ field: [msgs] }`). */
  readonly fieldErrors: Record<string, string[]> | null;

  constructor(input: {
    kind: FailureKind;
    message: string;
    statusCode?: number | null;
    fieldErrors?: Record<string, string[]> | null;
  }) {
    super(input.message);
    this.name = "ApiFailure";
    this.kind = input.kind;
    this.statusCode = input.statusCode ?? null;
    this.fieldErrors = input.fieldErrors ?? null;
  }

  get isAuth(): boolean {
    return this.kind === "unauthorized";
  }
}

const DEFAULT_MESSAGES: Record<FailureKind, string> = {
  network: "Unable to reach the server. Are you online?",
  timeout: "The request timed out. Check your connection and retry.",
  unauthorized: "Your session has expired. Please sign in again.",
  forbidden: "You are not allowed to do that.",
  notFound: "Not found.",
  conflict: "That action conflicts with the current state.",
  validation: "Please check the information you entered.",
  server: "Something went wrong on our side. Try again shortly.",
  cancelled: "Request cancelled.",
  unknown: "Something went wrong.",
};

function kindForStatus(status: number): FailureKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

function extractMessage(data: unknown): string | null {
  if (data === null || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (Array.isArray(record.message) && record.message.length > 0) {
    return String(record.message[0]);
  }
  if (typeof record.error === "string") return record.error;
  return null;
}

/** NestJS class-validator returns `message` as a flat array of strings. */
function extractFieldErrors(data: unknown): Record<string, string[]> | null {
  if (data === null || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.message)) {
    return { _: record.message.map(String) };
  }
  return null;
}

export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiFailure) return error;

  if (!isAxiosError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return new ApiFailure({ kind: "unknown", message });
  }

  if (error.response) {
    const status = error.response.status;
    const kind = kindForStatus(status);
    return new ApiFailure({
      kind,
      statusCode: status,
      message: extractMessage(error.response.data) ?? DEFAULT_MESSAGES[kind],
      fieldErrors: extractFieldErrors(error.response.data),
    });
  }

  const kind: FailureKind =
    error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
      ? "timeout"
      : error.code === "ERR_CANCELED"
        ? "cancelled"
        : "network";

  return new ApiFailure({ kind, message: DEFAULT_MESSAGES[kind] });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- apiFailure`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/kaya-core/src/errors
git commit -m "feat(core): typed API failures mapped from axios errors

Screens react on kind rather than status codes, so unauthorized can drive a
re-login prompt without every caller knowing about HTTP. class-validator's flat
message array is preserved under the _ key for form-level display.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: HTTP client and the auth interceptor

**Files:**
- Create: `packages/kaya-core/src/api/config.ts`, `packages/kaya-core/src/api/client.ts`
- Test: `packages/kaya-core/src/api/client.test.ts`

**Interfaces:**
- Consumes: `ApiFailure`/`toApiFailure` (Task 8), `authTokensSchema`/`AuthTokens` (Task 7), `TokenStore` from `../storage/tokenStore` (Task 12).

**Execution order:** Task 12 must be implemented before this task — the client and its test import `TokenStore` from `../storage/tokenStore`. Task 12 depends only on Task 7, so the dispatch order is 1–8, 12, 9, 10, 11, 13, 14.
- Produces: `class ApiConfig` with `restBaseUrl` and `socketUrl` getters; `createHttpClient(opts: { config: ApiConfig; store: TokenStore; onSessionExpired: () => Promise<void> | void }): AxiosInstance`.

**Note on request flags:** requests may set `config.skipAuth = true` to omit the bearer header and skip refresh entirely. The interceptor sets `config.retried = true` before replaying, so a request is replayed at most once.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/api/client.test.ts`:

```ts
import MockAdapter from "axios-mock-adapter";
import { ApiConfig } from "./config";
import { createHttpClient } from "./client";
import type { TokenStore } from "../storage/tokenStore";

class FakeStore implements TokenStore {
  access: string | null = "old-access";
  refresh: string | null = "refresh-1";
  cleared = false;
  saves = 0;

  async readAccess() {
    return this.access;
  }
  async readRefresh() {
    return this.refresh;
  }
  async save(t: { accessToken: string; refreshToken: string }) {
    this.saves += 1;
    this.access = t.accessToken;
    this.refresh = t.refreshToken;
  }
  async clear() {
    this.cleared = true;
    this.access = null;
    this.refresh = null;
  }
}

const config = new ApiConfig({ baseUrl: "http://localhost:3000" });

describe("ApiConfig", () => {
  it("appends the version prefix for REST and leaves the origin for sockets", () => {
    expect(config.restBaseUrl).toBe("http://localhost:3000/api/v1");
    expect(config.socketUrl).toBe("http://localhost:3000");
  });

  it("trims a trailing slash", () => {
    const c = new ApiConfig({ baseUrl: "http://localhost:3000/" });
    expect(c.restBaseUrl).toBe("http://localhost:3000/api/v1");
  });
});

describe("auth interceptor", () => {
  it("attaches the bearer token", async () => {
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    let seen: string | undefined;
    mock.onGet("/auth/me").reply((cfg) => {
      seen = cfg.headers?.Authorization as string | undefined;
      return [200, { id: "u1" }];
    });

    await client.get("/auth/me");
    expect(seen).toBe("Bearer old-access");
  });

  it("omits the bearer token when skipAuth is set", async () => {
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    let seen: string | undefined;
    mock.onPost("/auth/login").reply((cfg) => {
      seen = cfg.headers?.Authorization as string | undefined;
      return [200, {}];
    });

    await client.post("/auth/login", {}, { skipAuth: true } as never);
    expect(seen).toBeUndefined();
  });

  it("refreshes on 401 and replays the request once", async () => {
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    let attempts = 0;
    mock.onGet("/orders").reply(() => {
      attempts += 1;
      return attempts === 1 ? [401, {}] : [200, [{ id: "o1" }]];
    });
    mock.onPost("/auth/refresh").reply(200, {
      accessToken: "new-access",
      refreshToken: "refresh-2",
    });

    const res = await client.get("/orders");
    expect(res.status).toBe(200);
    expect(attempts).toBe(2);
    expect(store.access).toBe("new-access");
  });

  it("coalesces concurrent refreshes into a single call", async () => {
    // Two parallel 401s must not rotate the refresh token twice — the second
    // rotation would revoke the first and log the user out at random.
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    const seen: Record<string, number> = { a: 0, b: 0 };
    mock.onGet("/orders").reply(() => {
      seen.a += 1;
      return seen.a === 1 ? [401, {}] : [200, []];
    });
    mock.onGet("/notifications").reply(() => {
      seen.b += 1;
      return seen.b === 1 ? [401, {}] : [200, []];
    });

    let refreshCalls = 0;
    mock.onPost("/auth/refresh").reply(() => {
      refreshCalls += 1;
      return [200, { accessToken: "new-access", refreshToken: "refresh-2" }];
    });

    await Promise.all([client.get("/orders"), client.get("/notifications")]);
    expect(refreshCalls).toBe(1);
    expect(store.saves).toBe(1);
  });

  it("clears the session when the refresh itself fails", async () => {
    const store = new FakeStore();
    let expired = 0;
    const client = createHttpClient({
      config,
      store,
      onSessionExpired: () => {
        expired += 1;
      },
    });
    const mock = new MockAdapter(client);

    mock.onGet("/orders").reply(401, {});
    mock.onPost("/auth/refresh").reply(401, {});

    await expect(client.get("/orders")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(store.cleared).toBe(true);
    expect(expired).toBe(1);
  });

  it("does not refresh when there is no refresh token", async () => {
    const store = new FakeStore();
    store.refresh = null;
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);

    let refreshCalls = 0;
    mock.onGet("/orders").reply(401, {});
    mock.onPost("/auth/refresh").reply(() => {
      refreshCalls += 1;
      return [200, {}];
    });

    await expect(client.get("/orders")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(refreshCalls).toBe(0);
  });

  it("rejects with an ApiFailure, not a raw axios error", async () => {
    const store = new FakeStore();
    const client = createHttpClient({ config, store, onSessionExpired: () => {} });
    const mock = new MockAdapter(client);
    mock.onGet("/orders").reply(409, { message: "Offer already accepted" });

    await expect(client.get("/orders")).rejects.toMatchObject({
      kind: "conflict",
      message: "Offer already accepted",
    });
  });
});
```

- [ ] **Step 2: Add the test-only dependency**

Run: `npm install -D axios-mock-adapter@^2.1.0 -w @kaya/core`
Expected: `axios-mock-adapter` appears under `devDependencies` in `packages/kaya-core/package.json`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- client`
Expected: FAIL — `Cannot find module './config'`.

- [ ] **Step 4: Write `config.ts`**

Create `packages/kaya-core/src/api/config.ts`:

```ts
/**
 * Runtime API configuration. The base URL comes from the app's env config, so
 * no host is baked into the binary.
 */
export class ApiConfig {
  /** Origin only, e.g. http://localhost:3000 — no trailing slash, no prefix. */
  readonly baseUrl: string;
  /** Versioned REST prefix appended to the origin for REST calls. */
  readonly apiPrefix: string;

  constructor(input: { baseUrl: string; apiPrefix?: string }) {
    this.baseUrl = input.baseUrl.replace(/\/+$/, "");
    this.apiPrefix = input.apiPrefix ?? "/api/v1";
  }

  get restBaseUrl(): string {
    return `${this.baseUrl}${this.apiPrefix}`;
  }

  /** Socket.io connects to the origin; the gateway handles the namespace. */
  get socketUrl(): string {
    return this.baseUrl;
  }
}
```

- [ ] **Step 5: Write `client.ts`**

Create `packages/kaya-core/src/api/client.ts`:

```ts
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { toApiFailure } from "../errors/apiFailure";
import { type AuthTokens, authTokensSchema } from "../models/auth";
import type { TokenStore } from "../storage/tokenStore";
import type { ApiConfig } from "./config";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Omit the bearer header and never attempt a refresh for this request. */
    skipAuth?: boolean;
    /** Set internally once a request has been replayed after a refresh. */
    retried?: boolean;
  }
}

/**
 * Builds the shared HTTP client: bearer header on every request, transparent
 * refresh on 401, and a single replay of the original request.
 *
 * Concurrent refreshes are coalesced into one in-flight promise. Without that,
 * two simultaneous 401s rotate the refresh token twice; the second rotation
 * revokes the first and the user is signed out at random.
 */
export function createHttpClient(opts: {
  config: ApiConfig;
  store: TokenStore;
  onSessionExpired: () => Promise<void> | void;
}): AxiosInstance {
  const { config, store, onSessionExpired } = opts;

  const client = axios.create({
    baseURL: config.restBaseUrl,
    timeout: 20_000,
    headers: { "Content-Type": "application/json" },
  });

  /** A bare client with no interceptors, so refreshing cannot recurse. */
  const refreshClient = axios.create({
    baseURL: config.restBaseUrl,
    timeout: 20_000,
    headers: { "Content-Type": "application/json" },
  });

  let inFlightRefresh: Promise<AuthTokens | null> | null = null;

  async function doRefresh(): Promise<AuthTokens | null> {
    const refreshToken = await store.readRefresh();
    if (refreshToken === null || refreshToken === "") return null;
    try {
      const res = await refreshClient.post("/auth/refresh", { refreshToken });
      const tokens = authTokensSchema.parse(res.data);
      await store.save(tokens);
      return tokens;
    } catch {
      await store.clear();
      return null;
    }
  }

  function refreshTokens(): Promise<AuthTokens | null> {
    inFlightRefresh ??= doRefresh().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  }

  client.interceptors.request.use(async (req: InternalAxiosRequestConfig) => {
    if (req.skipAuth !== true) {
      const token = await store.readAccess();
      if (token !== null && token !== "") {
        req.headers.Authorization = `Bearer ${token}`;
      }
    }
    return req;
  });

  client.interceptors.response.use(
    (res) => res,
    async (error: unknown) => {
      const failure = toApiFailure(error);
      const req = axios.isAxiosError(error)
        ? (error.config as InternalAxiosRequestConfig | undefined)
        : undefined;

      const replayable =
        failure.kind === "unauthorized" &&
        req !== undefined &&
        req.skipAuth !== true &&
        req.retried !== true;

      if (!replayable) throw failure;

      const tokens = await refreshTokens();
      if (tokens === null) {
        await onSessionExpired();
        throw failure;
      }

      req.retried = true;
      req.headers.Authorization = `Bearer ${tokens.accessToken}`;
      try {
        return await refreshClient.request(req);
      } catch (replayError) {
        throw toApiFailure(replayError);
      }
    },
  );

  return client;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- client`
Expected: PASS, 9 tests. The coalescing test is the one that must never be skipped.

- [ ] **Step 7: Commit**

```bash
git add packages/kaya-core/src/api packages/kaya-core/package.json package-lock.json
git commit -m "feat(core): HTTP client with a single-flight refresh interceptor

Concurrent 401s share one in-flight refresh promise. Without that coalescing the
refresh token rotates twice, the second rotation revokes the first, and users are
signed out at random. Requests are replayed at most once, and failures surface as
ApiFailure rather than raw axios errors.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: The `KayaApi` endpoint surface

**Files:**
- Create: `packages/kaya-core/src/api/endpoints.ts`
- Test: `packages/kaya-core/src/api/endpoints.test.ts`

**Interfaces:**
- Consumes: the `AxiosInstance` from Task 9, every model schema from Tasks 5–7.
- Produces: `class KayaApi` with the methods listed below, each returning parsed model types.

Endpoint map, ported from `legacy/flutter/kaya_core/lib/src/api/kaya_api.dart`:

| Method | HTTP | Path | Returns |
|---|---|---|---|
| `register(body)` | POST | `/auth/register` | `AuthResult` |
| `login(body)` | POST | `/auth/login` | `LoginChallenge` |
| `loginVerify(body)` | POST | `/auth/login/verify` | `AuthResult` |
| `loginOtp(body)` | POST | `/auth/login/otp` | `AuthResult` |
| `socialLogin(body)` | POST | `/auth/social` | `SocialLoginOutcome` |
| `passwordReset(body)` | POST | `/auth/password-reset` | `void` |
| `me()` | GET | `/auth/me` | `User` |
| `updateProfile(body)` | PATCH | `/auth/profile` | `User` |
| `logout()` | POST | `/auth/logout` | `void` |
| `calculatePrice(query)` | GET | `/orders/calculate-price` | `PriceQuote` |
| `createOrder(body)` | POST | `/orders` | `Order` |
| `listOrders(query?)` | GET | `/orders` | `Order[]` |
| `getOrder(id)` | GET | `/orders/{id}` | `Order` |
| `publishOrder(id)` | POST | `/orders/{id}/publish` | `Order` |
| `cancelOrder(id)` | POST | `/deliveries/{id}/cancel` | `Delivery` |
| `nearbyOrders(query)` | GET | `/orders/nearby` | `Order[]` |
| `createOffer(orderId, body)` | POST | `/orders/{orderId}/offers` | `Offer` |
| `listOffers(orderId)` | GET | `/orders/{orderId}/offers` | `Offer[]` |
| `acceptOffer(offerId)` | POST | `/offers/{offerId}/accept` | `Delivery` |
| `rejectOffer(offerId)` | POST | `/offers/{offerId}/reject` | `Offer` |
| `getDelivery(id)` | GET | `/deliveries/{id}` | `Delivery` |
| `listDeliveries(query?)` | GET | `/deliveries` | `Delivery[]` |
| `startDelivery(id)` | POST | `/deliveries/{id}/start` | `Delivery` |
| `pickupDelivery(id, body)` | POST | `/deliveries/{id}/pickup` | `Delivery` |
| `transitDelivery(id)` | POST | `/deliveries/{id}/transit` | `Delivery` |
| `confirmDelivery(id, body)` | POST | `/deliveries/{id}/confirm-delivery` | `Delivery` |
| `initializePayment(body)` | POST | `/payments/initialize` | `{ authorizationUrl: string; reference: string }` |
| `verifyPayment(body)` | POST | `/payments/verify` | `Delivery` |
| `listMessages(deliveryId)` | GET | `/deliveries/{deliveryId}/messages` | `Message[]` |
| `sendMessage(deliveryId, body)` | POST | `/deliveries/{deliveryId}/messages` | `Message` |
| `markMessageRead(deliveryId, messageId)` | POST | `/deliveries/{deliveryId}/messages/{messageId}/read` | `void` |
| `rateDelivery(deliveryId, body)` | POST | `/deliveries/{deliveryId}/rate` | `Rating` |
| `listRatings(userId)` | GET | `/ratings` | `RatingSummary` |
| `driverBalance()` | GET | `/driver/balance` | `{ balance: number; currency: Currency }` |
| `driverEarnings(query?)` | GET | `/driver/earnings` | `Transaction[]` |
| `driverStats(query?)` | GET | `/driver/stats` | `DriverStats` |
| `requestWithdrawal(body)` | POST | `/driver/withdraw` | `Withdrawal` |
| `listWithdrawals()` | GET | `/driver/withdrawals` | `Withdrawal[]` |
| `listNotifications()` | GET | `/notifications` | `AppNotification[]` |
| `markNotificationRead(id)` | POST | `/notifications/{id}/read` | `void` |
| `markAllNotificationsRead()` | POST | `/notifications/read-all` | `void` |

- [ ] **Step 1: Verify each path against the Dart source before writing code**

Run:

```bash
grep -nE "\.(get|post|patch|put|delete)<" legacy/flutter/kaya_core/lib/src/api/kaya_api.dart
```

Expected: every path in the table above appears. If a path differs, the Dart source wins — correct the table and the implementation, and note the correction in the commit message.

- [ ] **Step 2: Write the failing test**

Create `packages/kaya-core/src/api/endpoints.test.ts`:

```ts
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { KayaApi } from "./endpoints";

const build = () => {
  const http = axios.create({ baseURL: "http://localhost:3000/api/v1" });
  return { api: new KayaApi(http), mock: new MockAdapter(http) };
};

describe("KayaApi", () => {
  it("parses the current user", async () => {
    const { api, mock } = build();
    mock.onGet("/auth/me").reply(200, {
      id: "u1",
      fullName: "Ama Owusu",
      role: "livreur",
      countryCode: "TGO",
      balance: "1200.00",
    });

    const user = await api.me();
    expect(user.fullName).toBe("Ama Owusu");
    expect(user.balance).toBe(1200);
  });

  it("parses a list of orders", async () => {
    const { api, mock } = build();
    mock.onGet("/orders").reply(200, [
      { id: "o1", status: "published", pickupLat: "5.5", pickupLng: "-0.2" },
    ]);

    const orders = await api.listOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.pickup).toEqual({ lat: 5.5, lng: -0.2 });
  });

  it("interpolates path parameters", async () => {
    const { api, mock } = build();
    mock.onPost("/offers/of-42/accept").reply(200, {
      id: "d1",
      orderId: "o1",
      livreurId: "u1",
      status: "in_progress",
      clientPaymentStatus: "escrow_held",
    });

    const delivery = await api.acceptOffer("of-42");
    expect(delivery.id).toBe("d1");
  });

  it("sends login with skipAuth so no bearer header is attached", async () => {
    const { api, mock } = build();
    let skipped: boolean | undefined;
    mock.onPost("/auth/login").reply((cfg) => {
      skipped = cfg.skipAuth;
      return [200, { challengeId: "ch1" }];
    });

    const challenge = await api.login({ identifier: "+233201234567", password: "x" });
    expect(challenge.challengeId).toBe("ch1");
    expect(skipped).toBe(true);
  });

  it("routes a new social email to the wizard outcome", async () => {
    const { api, mock } = build();
    mock.onPost("/auth/social").reply(200, {
      isNewAccount: true,
      socialDraftToken: "tok",
      email: "new@example.com",
    });

    const outcome = await api.socialLogin({ provider: "google", idToken: "t" });
    expect(outcome.kind).toBe("signup_required");
  });

  it("parses a price quote", async () => {
    const { api, mock } = build();
    mock.onGet("/orders/calculate-price").reply(200, {
      countryCode: "GHA",
      distanceKm: "6.2",
      minPrice: "24.00",
      currency: "GHS",
      pricePerKm: "1",
      basePickupFee: "2",
    });

    const quote = await api.calculatePrice({
      pickupLat: 5.5,
      pickupLng: -0.2,
      deliveryLat: 5.6,
      deliveryLng: -0.16,
    });
    expect(quote.minPrice).toBe(24);
    expect(quote.distanceKm).toBe(6.2);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- endpoints`
Expected: FAIL — `Cannot find module './endpoints'`.

- [ ] **Step 4: Write the implementation**

Create `packages/kaya-core/src/api/endpoints.ts`:

```ts
import { z } from "zod";
import type { AxiosInstance } from "axios";
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
 * three screens later.
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

  async updateProfile(body: unknown): Promise<User> {
    const res = await this.http.patch("/auth/profile", body);
    return userSchema.parse(res.data);
  }

  async logout(): Promise<void> {
    await this.http.post("/auth/logout");
  }

  // --- Orders ---------------------------------------------------------------

  async calculatePrice(params: {
    pickupLat: number;
    pickupLng: number;
    deliveryLat: number;
    deliveryLng: number;
  }): Promise<PriceQuote> {
    const res = await this.http.get("/orders/calculate-price", { params });
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
    lat: number;
    lng: number;
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

  async cancelOrder(deliveryId: string): Promise<Delivery> {
    const res = await this.http.post(`/deliveries/${deliveryId}/cancel`);
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

  async markMessageRead(deliveryId: string, messageId: string): Promise<void> {
    await this.http.post(`/deliveries/${deliveryId}/messages/${messageId}/read`);
  }

  // --- Ratings --------------------------------------------------------------

  async rateDelivery(deliveryId: string, body: unknown): Promise<Rating> {
    const res = await this.http.post(`/deliveries/${deliveryId}/rate`, body);
    return ratingSchema.parse(res.data);
  }

  async listRatings(userId: string): Promise<RatingSummary> {
    const res = await this.http.get("/ratings", { params: { userId } });
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

  async listNotifications(): Promise<AppNotification[]> {
    const res = await this.http.get("/notifications");
    return listOf(appNotificationSchema)(res.data);
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.http.post(`/notifications/${id}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.http.post("/notifications/read-all");
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- endpoints`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/kaya-core/src/api
git commit -m "feat(core): KayaApi covering the full REST surface

One method per backend endpoint, each parsing its response through the model
schema so a contract drift fails at the boundary instead of three screens later.
Auth entry points carry skipAuth so no stale bearer header is sent.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Realtime socket service

**Files:**
- Create: `packages/kaya-core/src/realtime/events.ts`, `packages/kaya-core/src/realtime/socket.ts`
- Test: `packages/kaya-core/src/realtime/events.test.ts`

**Interfaces:**
- Consumes: coercion helpers (Task 4), `messageSchema` (Task 7), `ApiConfig` (Task 9).
- Produces: `offerNewEventSchema`/`OfferNewEvent`, `offerAcceptedEventSchema`/`OfferAcceptedEvent`, `driverLocationEventSchema`/`DriverLocationEvent`, `deliveryStatusEventSchema`/`DeliveryStatusEvent`, `chatMessageEventSchema`/`ChatMessageEvent`, `SOCKET_EVENTS`, `class SocketService` with `connect(token)`, `disconnect()`, `joinDelivery(id)`, `leaveDelivery(id)`, `on(event, handler)`, `emitLocation(payload)`, `get connected`.

**Wire note:** these payloads are the one place the backend sends **snake_case** keys (`livreur_id`, `delivery_id`), unlike REST which is camelCase. Do not normalise them away in the schema — the gateway contract is what it is.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/realtime/events.test.ts`:

```ts
import {
  SOCKET_EVENTS,
  deliveryStatusEventSchema,
  driverLocationEventSchema,
  offerAcceptedEventSchema,
  offerNewEventSchema,
} from "./events";

describe("socket event schemas", () => {
  it("parses offer:new with camelCase keys", () => {
    const e = offerNewEventSchema.parse({
      offerId: "of1",
      orderId: "o1",
      livreurId: "u1",
      proposedPrice: "28.00",
    });
    expect(e.proposedPrice).toBe(28);
    expect(e.offerId).toBe("of1");
  });

  it("parses offer:accepted", () => {
    const e = offerAcceptedEventSchema.parse({
      offerId: "of1",
      orderId: "o1",
      deliveryId: "d1",
      livreurId: "u1",
    });
    expect(e.deliveryId).toBe("d1");
  });

  it("parses location:driver with snake_case keys", () => {
    const e = driverLocationEventSchema.parse({
      livreur_id: "u1",
      lat: "5.556",
      lng: "-0.1969",
      timestamp: "2026-08-02T10:30:00.000Z",
    });
    expect(e.livreurId).toBe("u1");
    expect(e.lat).toBe(5.556);
    expect(e.timestamp.toISOString()).toBe("2026-08-02T10:30:00.000Z");
  });

  it("parses delivery:status with snake_case keys", () => {
    const e = deliveryStatusEventSchema.parse({
      delivery_id: "d1",
      status: "picked_up",
      timestamp: "2026-08-02T10:30:00.000Z",
    });
    expect(e.deliveryId).toBe("d1");
    expect(e.status).toBe("picked_up");
  });

  it("exposes the event names the gateway emits", () => {
    expect(SOCKET_EVENTS.offerNew).toBe("offer:new");
    expect(SOCKET_EVENTS.offerAccepted).toBe("offer:accepted");
    expect(SOCKET_EVENTS.driverLocation).toBe("location:driver");
    expect(SOCKET_EVENTS.deliveryStatus).toBe("delivery:status");
    expect(SOCKET_EVENTS.chatMessage).toBe("chat:message");
    expect(SOCKET_EVENTS.locationUpdate).toBe("location:update");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- realtime`
Expected: FAIL — `Cannot find module './events'`.

- [ ] **Step 3: Write `events.ts`**

Create `packages/kaya-core/src/realtime/events.ts`:

```ts
import { z } from "zod";
import { dateLike, decimalLike, stringLike } from "../wire/coerce";
import { messageSchema } from "../models/message";

/**
 * Typed payloads for the NestJS gateway. Note the split: offer events use
 * camelCase, location and delivery events use snake_case. That is the contract
 * as emitted — do not normalise it here.
 */

export const SOCKET_EVENTS = {
  /** server -> client */
  offerNew: "offer:new",
  offerAccepted: "offer:accepted",
  driverLocation: "location:driver",
  deliveryStatus: "delivery:status",
  chatMessage: "chat:message",
  /** client -> server */
  locationUpdate: "location:update",
  joinDelivery: "delivery:join",
  leaveDelivery: "delivery:leave",
} as const;

export const offerNewEventSchema = z.object({
  offerId: stringLike(),
  orderId: stringLike(),
  livreurId: stringLike(),
  proposedPrice: decimalLike(),
});
export type OfferNewEvent = z.infer<typeof offerNewEventSchema>;

export const offerAcceptedEventSchema = z.object({
  offerId: stringLike(),
  orderId: stringLike(),
  deliveryId: stringLike(),
  livreurId: stringLike(),
});
export type OfferAcceptedEvent = z.infer<typeof offerAcceptedEventSchema>;

export const driverLocationEventSchema = z
  .object({
    livreur_id: z.unknown(),
    lat: decimalLike(),
    lng: decimalLike(),
    timestamp: dateLike(),
  })
  .transform((e) => ({
    livreurId: String(e.livreur_id ?? ""),
    lat: e.lat,
    lng: e.lng,
    timestamp: e.timestamp,
  }));
export type DriverLocationEvent = z.infer<typeof driverLocationEventSchema>;

export const deliveryStatusEventSchema = z
  .object({
    delivery_id: z.unknown(),
    status: stringLike(),
    timestamp: dateLike(),
  })
  .transform((e) => ({
    deliveryId: String(e.delivery_id ?? ""),
    status: e.status,
    timestamp: e.timestamp,
  }));
export type DeliveryStatusEvent = z.infer<typeof deliveryStatusEventSchema>;

export const chatMessageEventSchema = messageSchema;
export type ChatMessageEvent = z.infer<typeof chatMessageEventSchema>;
```

- [ ] **Step 4: Write `socket.ts`**

Create `packages/kaya-core/src/realtime/socket.ts`:

```ts
import { type Socket, io } from "socket.io-client";
import type { ApiConfig } from "../api/config";
import {
  SOCKET_EVENTS,
  type ChatMessageEvent,
  type DeliveryStatusEvent,
  type DriverLocationEvent,
  type OfferAcceptedEvent,
  type OfferNewEvent,
  chatMessageEventSchema,
  deliveryStatusEventSchema,
  driverLocationEventSchema,
  offerAcceptedEventSchema,
  offerNewEventSchema,
} from "./events";

export interface SocketEventMap {
  "offer:new": OfferNewEvent;
  "offer:accepted": OfferAcceptedEvent;
  "location:driver": DriverLocationEvent;
  "delivery:status": DeliveryStatusEvent;
  "chat:message": ChatMessageEvent;
}

const PARSERS = {
  "offer:new": offerNewEventSchema,
  "offer:accepted": offerAcceptedEventSchema,
  "location:driver": driverLocationEventSchema,
  "delivery:status": deliveryStatusEventSchema,
  "chat:message": chatMessageEventSchema,
} as const;

/**
 * Thin wrapper over socket.io-client. Every inbound payload is parsed before it
 * reaches a handler, so a gateway contract change surfaces as a thrown schema
 * error instead of an undefined field rendering blank on screen.
 */
export class SocketService {
  private socket: Socket | null = null;

  constructor(private readonly config: ApiConfig) {}

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  connect(accessToken: string): void {
    if (this.socket !== null) this.disconnect();
    this.socket = io(this.config.socketUrl, {
      transports: ["websocket"],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  joinDelivery(deliveryId: string): void {
    this.socket?.emit(SOCKET_EVENTS.joinDelivery, { deliveryId });
  }

  leaveDelivery(deliveryId: string): void {
    this.socket?.emit(SOCKET_EVENTS.leaveDelivery, { deliveryId });
  }

  /** Driver-side: publishes the current position (every 5 s while on a run). */
  emitLocation(payload: { deliveryId: string; lat: number; lng: number }): void {
    this.socket?.emit(SOCKET_EVENTS.locationUpdate, payload);
  }

  /** Returns an unsubscribe function. */
  on<K extends keyof SocketEventMap>(
    event: K,
    handler: (payload: SocketEventMap[K]) => void,
  ): () => void {
    const listener = (raw: unknown) => {
      handler(PARSERS[event].parse(raw) as SocketEventMap[K]);
    };
    this.socket?.on(event, listener);
    return () => {
      this.socket?.off(event, listener);
    };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- realtime`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/kaya-core/src/realtime
git commit -m "feat(core): typed socket.io service for the delivery gateway

Every inbound payload is parsed before reaching a handler, so a gateway contract
change throws instead of rendering an undefined field. Offer events are camelCase
while location and delivery events are snake_case — that asymmetry is the gateway
contract and is preserved deliberately.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Token store interface

**Files:**
- Create: `packages/kaya-core/src/storage/tokenStore.ts`
- Test: `packages/kaya-core/src/storage/tokenStore.test.ts`

**Interfaces:**
- Consumes: `AuthTokens` (Task 7).
- Produces: `interface TokenStore { readAccess(): Promise<string | null>; readRefresh(): Promise<string | null>; save(tokens: AuthTokens): Promise<void>; clear(): Promise<void> }` and `class InMemoryTokenStore implements TokenStore`.

The `expo-secure-store` implementation belongs to `@kaya/ui` (phase 1B) — `@kaya/core` must not import any `expo-*` package.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/storage/tokenStore.test.ts`:

```ts
import { InMemoryTokenStore } from "./tokenStore";

describe("InMemoryTokenStore", () => {
  it("starts empty", async () => {
    const store = new InMemoryTokenStore();
    expect(await store.readAccess()).toBeNull();
    expect(await store.readRefresh()).toBeNull();
  });

  it("round-trips a token pair", async () => {
    const store = new InMemoryTokenStore();
    await store.save({ accessToken: "a", refreshToken: "r" });
    expect(await store.readAccess()).toBe("a");
    expect(await store.readRefresh()).toBe("r");
  });

  it("clears both tokens", async () => {
    const store = new InMemoryTokenStore();
    await store.save({ accessToken: "a", refreshToken: "r" });
    await store.clear();
    expect(await store.readAccess()).toBeNull();
    expect(await store.readRefresh()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- tokenStore`
Expected: FAIL — `Cannot find module './tokenStore'`.

- [ ] **Step 3: Write the implementation**

Create `packages/kaya-core/src/storage/tokenStore.ts`:

```ts
import type { AuthTokens } from "../models/auth";

/**
 * Persistence boundary for the JWT pair. The interceptor depends on this
 * interface, never on a concrete store, so tests swap an in-memory one and the
 * platform keychain implementation can live in @kaya/ui without dragging a
 * native module into this package.
 */
export interface TokenStore {
  readAccess(): Promise<string | null>;
  readRefresh(): Promise<string | null>;
  save(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory store for tests, previews and the SKIP_AUTH dev path. */
export class InMemoryTokenStore implements TokenStore {
  private access: string | null = null;
  private refresh: string | null = null;

  async readAccess(): Promise<string | null> {
    return this.access;
  }

  async readRefresh(): Promise<string | null> {
    return this.refresh;
  }

  async save(tokens: AuthTokens): Promise<void> {
    this.access = tokens.accessToken;
    this.refresh = tokens.refreshToken;
  }

  async clear(): Promise<void> {
    this.access = null;
    this.refresh = null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- tokenStore`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/kaya-core/src/storage
git commit -m "feat(core): TokenStore interface with an in-memory implementation

The interceptor depends on the interface, never a concrete store, so the platform
keychain implementation can live in @kaya/ui without pulling a native module into
this package.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: i18n resources and instance factory

**Files:**
- Create: `packages/kaya-core/src/i18n/fr.json`, `packages/kaya-core/src/i18n/en.json`, `packages/kaya-core/src/i18n/index.ts`, `scripts/arb-to-json.mjs`
- Test: `packages/kaya-core/src/i18n/index.test.ts`

**Interfaces:**
- Consumes: `i18next`.
- Produces: `SUPPORTED_LOCALES = ["fr", "en"] as const`, `type Locale`, `resources`, `createI18n(locale?: Locale): i18n`. The React provider lives in `@kaya/ui` (phase 1B).

- [ ] **Step 1: Write the ARB conversion script**

Create `scripts/arb-to-json.mjs`:

```js
// Converts the Flutter ARB files into plain i18next JSON.
// ARB metadata keys start with "@" and are dropped; ICU placeholders {name}
// are already i18next-compatible.
import { readFileSync, writeFileSync } from "node:fs";

const pairs = [
  ["legacy/flutter/kaya_core/lib/l10n/app_fr.arb", "packages/kaya-core/src/i18n/fr.json"],
  ["legacy/flutter/kaya_core/lib/l10n/app_en.arb", "packages/kaya-core/src/i18n/en.json"],
];

for (const [src, dest] of pairs) {
  const arb = JSON.parse(readFileSync(src, "utf8"));
  const out = {};
  for (const [key, value] of Object.entries(arb)) {
    if (key.startsWith("@")) continue;
    out[key] = value;
  }
  writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`${dest}: ${Object.keys(out).length} keys`);
}
```

- [ ] **Step 2: Run the conversion**

Run: `node scripts/arb-to-json.mjs`
Expected output:

```
packages/kaya-core/src/i18n/fr.json: 155 keys
packages/kaya-core/src/i18n/en.json: 155 keys
```

If the two counts differ, a key is missing from one ARB file. Fix the ARB before continuing — a missing key renders as a raw identifier on screen.

- [ ] **Step 3: Write the failing test**

Create `packages/kaya-core/src/i18n/index.test.ts`:

```ts
import en from "./en.json";
import fr from "./fr.json";
import { SUPPORTED_LOCALES, createI18n } from "./index";

describe("translation resources", () => {
  it("ships French and English", () => {
    expect(SUPPORTED_LOCALES).toEqual(["fr", "en"]);
  });

  it("has the same key set in both languages", () => {
    const frKeys = Object.keys(fr).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it("has no empty translations", () => {
    for (const [key, value] of Object.entries({ ...fr, ...en })) {
      expect(typeof value === "string" && value.length > 0).toBe(true);
      expect(key.startsWith("@")).toBe(false);
    }
  });
});

describe("createI18n", () => {
  // createI18n initialises synchronously from bundled resources — there is no
  // backend to await, so the language is already set when it returns.
  it("defaults to French", () => {
    expect(createI18n().language).toBe("fr");
  });

  it("switches language", () => {
    expect(createI18n("en").language).toBe("en");
  });

  it("translates a known key in both languages", () => {
    const key = Object.keys(fr)[0] as string;
    expect(createI18n("fr").t(key)).toBe((fr as Record<string, string>)[key]);
    expect(createI18n("en").t(key)).toBe((en as Record<string, string>)[key]);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- i18n`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 5: Write the implementation**

Create `packages/kaya-core/src/i18n/index.ts`:

```ts
import { type i18n, createInstance } from "i18next";
import en from "./en.json";
import fr from "./fr.json";

/** French is the default; English is the toggle. */
export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

/**
 * Builds a standalone i18next instance. The React binding lives in @kaya/ui so
 * this package stays free of any React import.
 */
export function createI18n(locale: Locale = "fr"): i18n {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: "fr",
    resources,
    interpolation: { escapeValue: false },
  });
  return instance;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- i18n`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/arb-to-json.mjs packages/kaya-core/src/i18n
git commit -m "feat(core): FR/EN translation resources converted from the ARB files

A one-shot script strips the ARB @-metadata; ICU placeholders are already
i18next-compatible. A test asserts both languages carry the same key set, since a
key present in one file only renders as a raw identifier on screen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Barrel export, purity lint and CI

**Files:**
- Create: `packages/kaya-core/src/index.ts`, `packages/kaya-core/.eslintrc.cjs`, `.github/workflows/core.yml`
- Modify: `packages/kaya-core/package.json` (add the `lint` script and eslint devDependencies)
- Test: `packages/kaya-core/src/index.test.ts`

**Interfaces:**
- Consumes: every module from Tasks 2–13.
- Produces: the public surface of `@kaya/core`, re-exported from a single entry point. Apps and `@kaya/ui` import from `@kaya/core`, never from deep paths.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-core/src/index.test.ts`:

```ts
import * as core from "./index";

describe("@kaya/core public surface", () => {
  it("exports the money helpers", () => {
    expect(typeof core.roundMoney).toBe("function");
    expect(typeof core.formatMoney).toBe("function");
    expect(typeof core.commissionRateForDeliveryNumber).toBe("function");
    expect(typeof core.commissionPreview).toBe("function");
  });

  it("exports the model schemas", () => {
    expect(core.userSchema).toBeDefined();
    expect(core.orderSchema).toBeDefined();
    expect(core.offerSchema).toBeDefined();
    expect(core.deliverySchema).toBeDefined();
    expect(core.withdrawalSchema).toBeDefined();
  });

  it("exports the api, realtime, storage and i18n entry points", () => {
    expect(core.ApiConfig).toBeDefined();
    expect(typeof core.createHttpClient).toBe("function");
    expect(core.KayaApi).toBeDefined();
    expect(core.SocketService).toBeDefined();
    expect(core.InMemoryTokenStore).toBeDefined();
    expect(typeof core.createI18n).toBe("function");
    expect(core.ApiFailure).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @kaya/core -- index`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write the barrel**

Create `packages/kaya-core/src/index.ts`:

```ts
// Public surface of @kaya/core. Apps and @kaya/ui import from here, never from
// deep paths, so internal file moves stay internal.

export * from "./money/round";
export * from "./money/currency";
export * from "./money/commission";

export * from "./wire/coerce";
export * from "./wire/enums";

export * from "./models/geo";
export * from "./models/user";
export * from "./models/countryConfig";
export * from "./models/priceQuote";
export * from "./models/order";
export * from "./models/offer";
export * from "./models/delivery";
export * from "./models/message";
export * from "./models/rating";
export * from "./models/transaction";
export * from "./models/withdrawal";
export * from "./models/notification";
export * from "./models/auth";

export * from "./errors/apiFailure";

export * from "./api/config";
export * from "./api/client";
export * from "./api/endpoints";

export * from "./realtime/events";
export * from "./realtime/socket";

export * from "./storage/tokenStore";

export * from "./i18n";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @kaya/core -- index`
Expected: PASS, 3 tests.

If TypeScript reports a duplicate export (for example an `isRead` in both `notification.ts` and `message.ts`), rename the narrower one at its source rather than aliasing in the barrel, and update its test.

- [ ] **Step 5: Add the purity lint rule**

Run: `npm install -D eslint@^9.31.0 typescript-eslint@^8.20.0 -w @kaya/core`

Create `packages/kaya-core/.eslintrc.cjs`:

```js
/**
 * @kaya/core must stay platform-free: decision D2 in the migration design.
 * Importing react-native here would force every consumer of the money helpers
 * to boot a React Native test environment.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["react", "react-native", "react-native/*", "expo", "expo-*", "@react-native-firebase/*"],
            message:
              "@kaya/core must not import platform packages (design decision D2). Declare an interface here and put the adapter in @kaya/ui.",
          },
        ],
      },
    ],
  },
  ignorePatterns: ["dist/"],
};
```

Add to `packages/kaya-core/package.json` scripts:

```json
"lint": "eslint src --ext .ts"
```

- [ ] **Step 6: Verify the rule actually fires**

Create a scratch file `packages/kaya-core/src/__purity_probe.ts`:

```ts
import { View } from "react-native";
export const probe = View;
```

Run: `npm run lint -w @kaya/core`
Expected: FAIL with `@kaya/core must not import platform packages (design decision D2).`

Then delete the probe:

```bash
rm packages/kaya-core/src/__purity_probe.ts
```

Run: `npm run lint -w @kaya/core`
Expected: PASS, no errors.

- [ ] **Step 7: Add CI**

Create `.github/workflows/core.yml`:

```yaml
name: core

on:
  push:
    branches: [main]
  pull_request:

jobs:
  core:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint -w @kaya/core
      - run: npm run typecheck -w @kaya/core
      - run: npm test -w @kaya/core
```

- [ ] **Step 8: Run the full suite**

Run: `npm run lint -w @kaya/core && npm run typecheck -w @kaya/core && npm test -w @kaya/core`
Expected: lint clean, no type errors, all tests pass (roughly 80 across 13 suites).

- [ ] **Step 9: Commit**

```bash
git add packages/kaya-core .github/workflows/core.yml package-lock.json
git commit -m "feat(core): public barrel, platform-purity lint and CI

A no-restricted-imports rule fails the build if @kaya/core ever imports react,
react-native or an expo package — decision D2, which is what keeps the money-path
tests runnable without a mobile toolchain. CI runs lint, typecheck and tests.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** Spec § 3 structure → Task 1. § 4 `models/` → Tasks 5–7; `money/` → Tasks 1–3; `api/` → Tasks 9–10; `errors/` → Task 8; `realtime/` → Task 11; `storage/` → Task 12; `i18n/` → Task 13. § 4 core/ui boundary → enforced by the lint rule in Task 14. § 9 test level 1 (money paths, Zod parsing, refresh coalescing) → Tasks 2, 3, 4, 9. Spec § 5 (`@kaya/ui`), § 6 (apps), § 7 (native integrations) are phase 1B and 1C, out of this plan by design.

**Deferred to 1B/1C, deliberately:** `SecureTokenStore` on `expo-secure-store`, the `react-i18next` provider, the location/image/push adapters, every UI component, both Expo apps.

**Known follow-up:** Task 10's endpoint table is transcribed from the Dart client; Step 1 of that task verifies each path against the source before any code is written, and instructs the implementer to treat the Dart as authoritative on any mismatch.
