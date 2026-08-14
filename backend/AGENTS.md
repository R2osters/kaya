# AGENTS.md - Backend coding guide

Scope: `backend/` (NestJS API) only. Business rules, money/commission logic,
and architecture decisions live in `../ASSISTANT.md` and `../BLUEPRINT.md` -
read those first. This file covers code-level conventions so agents don't
have to re-derive them from the diff each time.

## Commands

```bash
npm run start:dev       # watch mode
npm run build            # nest build
npm run lint              # eslint --fix (src, test, scripts)
npm run knip              # dead code / unused exports / unused deps
npm test                  # jest unit tests
npm run test:e2e          # jest e2e (test/*.e2e-spec.ts, needs DATABASE_URL)
npm run test -- src/orders/orders.service.spec.ts   # single file
npm run prisma:migrate    # new migration (dev)
npm run generate:keys     # dev RS256 keypair for JWT
```

Git hooks (husky, configured at the repo root, not here) run `lint-staged`
on `backend/**/*.ts` pre-commit and `commitlint` on the commit message.
Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`,
`test:`, `chore:`).

## Formatting

`.prettierrc`: single quotes, trailing commas everywhere, 100 col width,
default (2-space) indent. `npm run lint` auto-fixes both eslint and
prettier-covered issues; don't hand-format.

## ESLint (`eslint.config.mjs`)

Flat config, `typescript-eslint` `recommendedTypeChecked` +
`stylisticTypeChecked` (real type errors, not just style) plus
`eslint-plugin-sonarjs`. Notably enforced:

- **Boolean variables must be prefixed** `is/should/has/can/did/will`
  (`isVerified`, `shouldSuspend`, `hasLivreurRole` - not `verified`,
  `suspend`, `matches`).
- **Module-level constants** may be `UPPER_CASE` (`API_PREFIX`,
  `MAX_BYTES`) - this is the established pattern for file-scoped config
  values; everything else stays `camelCase`.
- **Enum members mirror Prisma enum casing** (`snake_case`, e.g.
  `TransactionType.payment_in`), matching the schema they represent -
  don't PascalCase them.
- Test files (`*.spec.ts`, `test/**`) relax the `no-unsafe-*` rules and
  `sonarjs/no-hardcoded-passwords` - jest mocks and supertest bodies are
  legitimately untyped, and fixture credentials aren't real secrets.
- `src/realtime/**` relaxes `no-unsafe-*` too - `Socket#data` is untyped
  upstream; that module is the one narrow place the `any` gets unwrapped.
- Leading-underscore names (`_clientId`, `_passwordHash` in a destructure)
  are the "intentionally unused" signal and are exempt from
  `no-unused-vars` - keep using that convention instead of just deleting
  the binding when you need to drop a field from a spread.

When a rule is a genuine false positive for one line, use
`// eslint-disable-next-line <rule> -- <reason>` with a real reason, not a
blanket disable. If a single line's reported position looks inconsistent
between runs (seen with `sonarjs/content-length` on an object literal),
prefer a file-scoped `/* eslint-disable <rule> -- <reason> */` at the top
over chasing the exact line.

## Knip (`knip.json`)

Run `npm run knip` before finishing a milestone (M6 does this repo-wide).
It reports unused exports, unused devDependencies, and unused enum
members. Two rules of thumb:

- If a `type`/`interface`/`const` is exported but only ever used inside
  its own file, drop the `export` keyword instead of ignoring the finding.
- A finding can be a real false positive - e.g. an enum member that's only
  ever compared against as a string literal (through `@IsEnum` DTO
  validation) rather than accessed as `Enum.Member` in code. When that
  happens, leave a one-line comment next to the member explaining why
  (see `DisputeOutcome.refund_client` in `src/admin/dto/admin.dto.ts`)
  instead of fighting knip's config for an exact suppression.

## File naming

| Type | Pattern | Example |
|---|---|---|
| Service | `kebab-case.service.ts` | `orders.service.ts` |
| Controller | `kebab-case.controller.ts` | `payments.controller.ts` |
| Module | `kebab-case.module.ts` | `commission.module.ts` |
| DTO | `dto/kebab-case.dto.ts` | `dto/create-rating.dto.ts` |
| Interface | `kebab-case.interface.ts` | `payment-gateway.interface.ts` |
| Provider impl | `providers/kebab-case.gateway.ts` / `.provider.ts` | `providers/kkiapay.gateway.ts` |
| Unit test | `*.spec.ts`, colocated with the file it tests | `orders.service.spec.ts` |
| E2E test | `test/*.e2e-spec.ts` | `test/money-flow.e2e-spec.ts` |

## Import order

1. `@nestjs/*`
2. Other third-party (`@prisma/client`, `bcryptjs`, `crypto`, ...)
3. Local, relative (`../config/app-config.service`, `./dto/...`)

Type-only imports use `import type { X } from '...'` when nothing but the
type is needed (see `roles.guard.ts`, `current-user.decorator.ts`).

## Error handling & logging

Use NestJS's built-in exceptions - `BadRequestException`,
`NotFoundException`, `ForbiddenException`, `ConflictException`,
`UnauthorizedException` - never hand-roll an HTTP error shape.

```typescript
if (!delivery) {
  throw new NotFoundException('Delivery not found.');
}
if (delivery.order.clientId !== clientId) {
  throw new ForbiddenException('You do not own this delivery.');
}
```

One `Logger` instance per service/controller, named after the class:

```typescript
private readonly logger = new Logger(PaymentsService.name);
```

Catch-block/`.catch()` params are `unknown`, not `any` - narrow before use:

```typescript
.catch((err: unknown) =>
  this.logger.warn(`... ${err instanceof Error ? err.message : String(err)}`),
);
```

## Money

Always `Prisma.Decimal`, never `number`/`float`, for any amount
(`commission.service.ts`, `payments.service.ts`, `ledger.service.ts` are
the reference implementations). Round with
`.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)` at the point of
persistence, not earlier.

## External integrations: interface + provider + factory

Every swappable external dependency (payment gateway, distance/maps
provider, push notification provider, OTP delivery) follows the same
shape - see `src/payments/`, `src/maps/`, `src/notifications/`,
`src/auth/otp/`:

1. An interface in the module root (`*.interface.ts`) describing the
   contract.
2. One implementation per provider under `providers/`, plus a keyless
   **mock implementation that always works in dev/demo** (no external
   credentials needed).
3. A factory (or simple `AppConfigService`-gated constructor selection)
   that picks the real implementation when credentials are configured,
   and falls back to the mock otherwise.

Don't call a third-party SDK directly from a service - add it behind this
pattern, even for a single-provider case, so the mock path keeps working.

## Testing patterns (Jest)

Unit tests construct the service directly with hand-built mocks cast
`as never` (no `@nestjs/testing` `Test.createTestingModule` needed for a
plain-constructor service):

```typescript
const prisma = { $transaction: jest.fn(async (cb: (t: unknown) => unknown) => await cb(tx)) };
const service = new PaymentsService(prisma as never, gateways as never, ledger as never, notifications as never);
```

Note the `await cb(tx)` inside the mock `$transaction` implementation -
required to satisfy `@typescript-eslint/require-await` even though the
callback's own await is what actually matters.

E2E specs (`test/*.e2e-spec.ts`) probe `DATABASE_URL` reachability first
and skip the whole suite when it's unreachable, so `npm test`/`npm run
test:e2e` still exit clean on a machine without the docker-compose stack
running - see `isDbAvailable` / `databaseReachable()` in
`test/auth.e2e-spec.ts`.
