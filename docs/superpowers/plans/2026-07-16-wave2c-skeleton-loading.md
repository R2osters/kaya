# Wave 2c — Full-App Skeleton Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every network-data-loading `CircularProgressIndicator` in `apps/client` and `apps/driver` with a content-shaped `KayaSkeleton` shimmer placeholder, per the user's confirmed full-app scope (see the spec's "Scope decisions" section, resolved 2026-07-16).

**Architecture:** One small widget family lives in `kaya_core` (`KayaSkeletonBox`, `KayaSkeletonListTile`/`KayaSkeletonList`, `KayaSkeletonCard`) — this is genuinely shared, unlike screens, because it's presentation-only with no app-specific logic. Every call site swap is mechanical: a `loading:` branch (Riverpod `AsyncValue.when`) or an `isLoading ? spinner : content` ternary gets its spinner replaced by whichever preset matches the shape of the content that's about to appear (a list gets `KayaSkeletonList`, a single detail/card gets `KayaSkeletonCard`).

**Tech Stack:** Flutter 3.22+, new dependency: `shimmer`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-social-login-2fa-wizard-design.md`, "Skeleton loading" section + the 2026-07-16 scope-decision addendum. Independent of `wave2a`/`wave2b` — touches no auth files, can land in any order relative to those two plans.
- **Not every `CircularProgressIndicator` in the codebase is a network-loading placeholder** — Task 2's discovery step below already ran (its exact grep command is repeatable, so a reviewer can re-verify the list) and found 5 occurrences that are deliberately excluded, each for a specific reason, not oversight:
  1. `apps/driver/lib/features/home/new_request_popup.dart:80` — this is a **countdown ring** (`value: _remaining / widget.seconds`), not a busy indicator. Skeleton loading is a stand-in for "content not here yet"; this widget's content (the popup) is already fully rendered — the ring is showing time remaining, not absence of data. Left as-is.
  2. `apps/client/lib/features/splash_screen.dart:27` and `apps/driver/lib/features/splash_screen.dart:22` — full-screen brand splash while the auth bootstrap check runs. There is no content shape to mimic (it's a logo on a colored background, not a list or card about to populate) — a skeleton would have nothing to skeleton. Left as-is.
  3. `apps/driver/lib/features/home/driver_home_screen.dart:152` — a small inline spinner substituting the online/offline `Switch` while `setOnline()`'s network call is in flight. This is an **action-pending** indicator (same family as `KayaButton`'s own built-in `loading` spinner), not a content-loading one. Left as-is.
  4. `apps/client/lib/features/payment/payment_webview_screen.dart:81` — a `ColoredBox` overlay spinner shown *on top of* the already-visible `WebViewWidget` while a payment is being verified. The content underneath is already rendered; a skeleton (which implies the content isn't there yet) would be visually wrong here — this is legitimately a modal-busy overlay. Left as-is.
  5. `apps/client/lib/features/offers/offers_screen.dart:101` — a small inline spinner next to "awaiting offers" text, shown when the offers list is *empty but still polling*, not while the initial list request is in flight (that's the *other* spinner in the same file, at line 91, which **is** replaced — see Task 4). This one pairs with explanatory text about an ongoing wait, not a not-yet-loaded list shape. Left as-is.

  Do not "complete the sweep" by skeletonizing these five — that would contradict the reasoning above, not fulfill it.
- Every task leaves `flutter analyze` and `flutter test` clean in whichever package/app it touches.
- Code + comments in English.

---

### Task 1: `kaya_core` — `KayaSkeleton` widget family

**Files:**
- Create: `packages/kaya_core/lib/src/theme/widgets/kaya_skeleton.dart`
- Modify: `packages/kaya_core/lib/kaya_core.dart` (export)
- Modify: `packages/kaya_core/pubspec.yaml` (add `shimmer`)
- Create: `packages/kaya_core/test/kaya_skeleton_test.dart`

**Interfaces:**
- Produces: `KayaSkeletonBox({width, height = 14, borderRadius, shape = BoxShape.rectangle})`, `KayaSkeletonListTile()`, `KayaSkeletonList({count = 4})`, `KayaSkeletonCard()`. Tasks 3-5 depend on these four names and constructors exactly.

- [ ] **Step 1: Add the dependency**

In `packages/kaya_core/pubspec.yaml`, add to `dependencies:` after `flutter_facebook_auth` (or after `firebase_auth` if Wave 2a hasn't landed yet in this checkout — either position is fine, `pubspec.yaml` key order doesn't matter to `pub`):

```yaml
  shimmer: ^3.0.0
```

Run: `cd packages/kaya_core && flutter pub get`

- [ ] **Step 2: Write the failing test**

```dart
// packages/kaya_core/test/kaya_skeleton_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets('KayaSkeletonList renders `count` list tiles', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KayaSkeletonList(count: 3)));
    expect(find.byType(KayaSkeletonListTile), findsNWidgets(3));
  });

  testWidgets('KayaSkeletonList defaults to 4 tiles', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KayaSkeletonList()));
    expect(find.byType(KayaSkeletonListTile), findsNWidgets(4));
  });

  testWidgets('KayaSkeletonCard renders without error', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KayaSkeletonCard()));
    expect(find.byType(KayaSkeletonCard), findsOneWidget);
    expect(find.byType(KayaSkeletonBox), findsWidgets);
  });

  testWidgets('KayaSkeletonBox honors shape: circle', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: KayaSkeletonBox(width: 44, height: 44, shape: BoxShape.circle)),
    );
    final container = tester.widget<Container>(find.byType(Container));
    final decoration = container.decoration as BoxDecoration;
    expect(decoration.shape, BoxShape.circle);
  });
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/kaya_core && flutter test test/kaya_skeleton_test.dart`
Expected: FAIL — none of the four widgets exist yet.

- [ ] **Step 4: Write the widgets**

```dart
// packages/kaya_core/lib/src/theme/widgets/kaya_skeleton.dart
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../app_colors.dart';
import '../app_radii.dart';

/// Base shimmering placeholder box, self-animating. Compose several inside
/// [KayaSkeletonListTile]/[KayaSkeletonCard], or use standalone.
class KayaSkeletonBox extends StatelessWidget {
  const KayaSkeletonBox({
    super.key,
    this.width,
    this.height = 14,
    this.borderRadius,
    this.shape = BoxShape.rectangle,
  });

  final double? width;
  final double height;
  final BorderRadius? borderRadius;
  final BoxShape shape;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.background,
      highlightColor: AppColors.surface,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.background,
          shape: shape,
          borderRadius: shape == BoxShape.circle
              ? null
              : (borderRadius ?? BorderRadius.circular(AppRadii.field)),
        ),
      ),
    );
  }
}

/// One skeleton row: leading avatar circle, two stacked text lines, a
/// trailing chip. Matches the shape of a typical list row across both apps
/// (order/delivery/notification/inbox rows).
class KayaSkeletonListTile extends StatelessWidget {
  const KayaSkeletonListTile({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          const KayaSkeletonBox(width: 44, height: 44, shape: BoxShape.circle),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                KayaSkeletonBox(width: double.infinity, height: 14),
                SizedBox(height: 8),
                KayaSkeletonBox(width: 120, height: 12),
              ],
            ),
          ),
          const SizedBox(width: 14),
          const KayaSkeletonBox(width: 48, height: 20),
        ],
      ),
    );
  }
}

/// The standard stand-in for a list-shaped `loading:` branch — repeats
/// [KayaSkeletonListTile] [count] times inside a scrollable list.
class KayaSkeletonList extends StatelessWidget {
  const KayaSkeletonList({super.key, this.count = 4});
  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      itemBuilder: (_, __) => const KayaSkeletonListTile(),
    );
  }
}

/// The standard stand-in for a single detail/summary card — a title line,
/// three body lines of decreasing width, and a footer action row. Used for
/// single-item screens (delivery detail, stats, profile header) rather than
/// lists.
class KayaSkeletonCard extends StatelessWidget {
  const KayaSkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          KayaSkeletonBox(width: 160, height: 18),
          SizedBox(height: 16),
          KayaSkeletonBox(width: double.infinity, height: 14),
          SizedBox(height: 8),
          KayaSkeletonBox(width: double.infinity, height: 14),
          SizedBox(height: 8),
          KayaSkeletonBox(width: 200, height: 14),
          SizedBox(height: 20),
          Row(
            children: [
              KayaSkeletonBox(width: 80, height: 32),
              SizedBox(width: 12),
              KayaSkeletonBox(width: 80, height: 32),
            ],
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 5: Export from the package barrel**

In `packages/kaya_core/lib/kaya_core.dart`, add next to the other `theme/widgets/*` exports:

```dart
export 'src/theme/widgets/kaya_skeleton.dart';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/kaya_core && flutter test test/kaya_skeleton_test.dart && flutter analyze`
Expected: all 4 tests pass, clean.

- [ ] **Step 7: Commit**

```bash
git add packages/kaya_core/pubspec.yaml packages/kaya_core/pubspec.lock packages/kaya_core/lib/src/theme/widgets/kaya_skeleton.dart packages/kaya_core/lib/kaya_core.dart packages/kaya_core/test/kaya_skeleton_test.dart
git commit -m "feat(kaya_core): add KayaSkeleton widget family (box/list-tile/list/card)"
```

---

### Task 2: Discovery — confirm the exact inventory of call sites

**Files:** none modified — this task only re-verifies the list every later task in this plan is built against, so a reviewer can trust it wasn't guessed.

- [ ] **Step 1: Run the discovery grep**

Run, from the repo root:
```bash
grep -rn "CircularProgressIndicator" apps/client/lib apps/driver/lib
```

- [ ] **Step 2: Confirm the count and cross-check against the classification below**

Expected: **21 matches**. 5 are excluded per Global Constraints (listed there with file:line and reasoning). The remaining **16** are this plan's scope, split across Tasks 3-5:

| # | File | Line | Shape | Preset | Task |
|---|------|------|-------|--------|------|
| 1 | `apps/client/lib/features/profile/profile_screen.dart` | 37 | detail | `KayaSkeletonCard` | 3 (worked example) |
| 2 | `apps/client/lib/features/history/history_screen.dart` | 44 | list | `KayaSkeletonList` | 4 |
| 3 | `apps/client/lib/features/notifications/notifications_screen.dart` | 26 | list | `KayaSkeletonList` | 4 |
| 4 | `apps/client/lib/features/chat/inbox_screen.dart` | 25 | list | `KayaSkeletonList` | 4 |
| 5 | `apps/client/lib/features/chat/chat_screen.dart` | 65 | list | `KayaSkeletonList` | 4 |
| 6 | `apps/client/lib/features/offers/offers_screen.dart` | 91 | list | `KayaSkeletonList` | 4 |
| 7 | `apps/driver/lib/features/stats/stats_screen.dart` | 27 | detail | `KayaSkeletonCard` | 5 |
| 8 | `apps/driver/lib/features/home/driver_home_screen.dart` | 235 | list | `KayaSkeletonList` | 5 |
| 9 | `apps/driver/lib/features/profile/profile_screen.dart` | 34 | detail | `KayaSkeletonCard` | 5 |
| 10 | `apps/driver/lib/features/earnings/earnings_screen.dart` | 107 | list | `KayaSkeletonList` | 5 |
| 11 | `apps/driver/lib/features/delivery/active_delivery_screen.dart` | 64 | detail | `KayaSkeletonCard` | 5 |
| 12 | `apps/driver/lib/features/notifications/notifications_screen.dart` | 25 | list | `KayaSkeletonList` | 5 |
| 13 | `apps/driver/lib/features/offer/propose_price_screen.dart` | 62 | detail | `KayaSkeletonCard` | 5 |
| 14 | `apps/driver/lib/features/history/delivery_history_screen.dart` | 27 | list | `KayaSkeletonList` | 5 |
| 15 | `apps/driver/lib/features/history/delivery_detail_screen.dart` | 28 | detail | `KayaSkeletonCard` | 5 |

(15 rows above + this task's own re-run keeps the count honest — if your checkout's re-run finds a 16th or a different count, stop and reconcile against the exclusion list and this table before proceeding; something changed since this plan was written and the mismatch needs to be understood, not silently absorbed into the next task.)

- [ ] **Step 2: No commit** — this task produces no diff, only confirms the table above still matches the working tree before Tasks 3-5 start editing it.

---

### Task 3: Worked example — `apps/client/lib/features/profile/profile_screen.dart`

**Files:**
- Modify: `apps/client/lib/features/profile/profile_screen.dart`
- Create: `apps/client/test/profile_skeleton_test.dart`

This task exists to demonstrate the exact pattern Tasks 4 and 5 repeat mechanically at their other 14 call sites — full code shown once here rather than 14 more times for edits that are otherwise identical in shape.

**Interfaces:**
- Consumes: `KayaSkeletonCard` (Task 1).

- [ ] **Step 1: Write the failing test**

```dart
// apps/client/test/profile_skeleton_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/features/profile/profile_screen.dart';
import 'package:kaya_client/providers/auth_provider.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets('shows a KayaSkeletonCard while the user is null', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [currentUserProvider.overrideWithValue(null)],
        child: const MaterialApp(
          localizationsDelegates: [KayaL10n.delegate],
          supportedLocales: KayaL10n.supportedLocales,
          home: ProfileScreen(),
        ),
      ),
    );
    expect(find.byType(KayaSkeletonCard), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('shows the real profile once the user loads', (tester) async {
    const user = User(
      id: 'u1',
      email: 'kofi@example.com',
      phone: '+233201234567',
      fullName: 'Kofi Mensah',
      role: UserRole.client,
      countryCode: CountryCode.GHA,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [currentUserProvider.overrideWithValue(user)],
        child: const MaterialApp(
          localizationsDelegates: [KayaL10n.delegate],
          supportedLocales: KayaL10n.supportedLocales,
          home: ProfileScreen(),
        ),
      ),
    );
    expect(find.byType(KayaSkeletonCard), findsNothing);
    expect(find.text('Kofi Mensah'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/client && flutter test test/profile_skeleton_test.dart`
Expected: FAIL on the first test — `find.byType(KayaSkeletonCard)` finds nothing because the screen still shows `CircularProgressIndicator`.

- [ ] **Step 3: Swap the spinner**

In `apps/client/lib/features/profile/profile_screen.dart`, line 37:

```dart
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
```

becomes:

```dart
      body: user == null
          ? const KayaSkeletonCard()
          : ListView(
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/client && flutter test test/profile_skeleton_test.dart && flutter analyze`
Expected: both tests pass, clean.

- [ ] **Step 5: Commit**

```bash
git add apps/client/lib/features/profile/profile_screen.dart apps/client/test/profile_skeleton_test.dart
git commit -m "feat(client): replace profile screen's loading spinner with KayaSkeletonCard"
```

---

### Task 4: Client — remaining 5 screens (row 2-6 of Task 2's table)

**Files:**
- Modify: `apps/client/lib/features/history/history_screen.dart`
- Modify: `apps/client/lib/features/notifications/notifications_screen.dart`
- Modify: `apps/client/lib/features/chat/inbox_screen.dart`
- Modify: `apps/client/lib/features/chat/chat_screen.dart`
- Modify: `apps/client/lib/features/offers/offers_screen.dart`

Each edit follows Task 3's exact pattern — swap a `Center(child: CircularProgressIndicator())` for `KayaSkeletonList()` — so this task applies all five in one pass rather than five near-identical single-file tasks. Widget-testing all five individually would duplicate Task 3's already-proven test shape with no new risk surfaced; instead, this task's own verification step (Step 6) is a repo-wide grep confirming zero remaining matches at these five exact locations, which is what actually matters (a wrong preset choice would be caught by `flutter analyze`/`flutter test` failing to find the type in existing tests that reference these screens, and by visual QA — not by a bespoke test per file).

- [ ] **Step 1: `history_screen.dart`**

Line 43-44:
```dart
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
                loading: () => const KayaSkeletonList(),
```

- [ ] **Step 2: `notifications_screen.dart`**

Line 26:
```dart
        loading: () => const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
        loading: () => const KayaSkeletonList(),
```

- [ ] **Step 3: `inbox_screen.dart`**

Line 25 — identical replacement to Step 2, same file shape (`async.when(loading: ...)`).

- [ ] **Step 4: `chat_screen.dart`**

Line 64-66:
```dart
            child: state.loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
```
becomes:
```dart
            child: state.loading
                ? const KayaSkeletonList()
                : ListView(
```

- [ ] **Step 5: `offers_screen.dart`**

Line 88-92:
```dart
              if (state.loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
```
becomes:
```dart
              if (state.loading)
                const SizedBox(height: 240, child: KayaSkeletonList(count: 3))
```
(A fixed height replaces the `Padding`+`Center` wrapper because `KayaSkeletonList` is itself a scrollable `ListView.builder`, which needs a bounded height when nested inside another scrollable — the surrounding `ListView` this sits in, per the earlier `child: ListView(... l10n.offersTitle ...)` context. Do **not** touch the second spinner in this file at line 101 — see Global Constraints, exclusion #5.)

- [ ] **Step 6: Verify**

Run:
```bash
cd apps/client
grep -n "CircularProgressIndicator" lib/features/history/history_screen.dart lib/features/notifications/notifications_screen.dart lib/features/chat/inbox_screen.dart lib/features/chat/chat_screen.dart
```
Expected: no output (all four fully swapped).

```bash
grep -n "CircularProgressIndicator" lib/features/offers/offers_screen.dart
```
Expected: exactly one match, at line 101 (the intentionally-excluded "awaiting offers" spinner).

Then: `flutter test && flutter analyze`
Expected: clean (existing tests for these screens, if any, still pass — this plan doesn't add new tests for this task per the rationale above).

- [ ] **Step 7: Commit**

```bash
git add apps/client/lib/features/history/history_screen.dart apps/client/lib/features/notifications/notifications_screen.dart apps/client/lib/features/chat/inbox_screen.dart apps/client/lib/features/chat/chat_screen.dart apps/client/lib/features/offers/offers_screen.dart
git commit -m "feat(client): replace remaining list-loading spinners with KayaSkeletonList"
```

---

### Task 5: Driver — remaining 9 screens (rows 7-15 of Task 2's table)

**Files:**
- Modify: `apps/driver/lib/features/stats/stats_screen.dart`
- Modify: `apps/driver/lib/features/home/driver_home_screen.dart`
- Modify: `apps/driver/lib/features/profile/profile_screen.dart`
- Modify: `apps/driver/lib/features/earnings/earnings_screen.dart`
- Modify: `apps/driver/lib/features/delivery/active_delivery_screen.dart`
- Modify: `apps/driver/lib/features/notifications/notifications_screen.dart`
- Modify: `apps/driver/lib/features/offer/propose_price_screen.dart`
- Modify: `apps/driver/lib/features/history/delivery_history_screen.dart`
- Modify: `apps/driver/lib/features/history/delivery_detail_screen.dart`

Same rationale as Task 4 — nine mechanical swaps of the same two shapes, batched into one task with one verification pass rather than nine.

- [ ] **Step 1: `stats_screen.dart`, line 27** (detail shape — driver stats is a single summary, not a list):
```dart
        loading: () => const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
        loading: () => const KayaSkeletonCard(),
```

- [ ] **Step 2: `driver_home_screen.dart`, lines 232-235** (list shape — nearby orders):
```dart
                                loading: () => const Center(
                                    child: Padding(
                                  padding: EdgeInsets.all(24),
                                  child: CircularProgressIndicator(),
                                )),
```
becomes:
```dart
                                loading: () => const SizedBox(
                                  height: 280,
                                  child: KayaSkeletonList(count: 3),
                                ),
```
(Bounded height for the same nesting reason as Task 4 Step 5 — this sits inside a `Flexible` inside a `Column`, which needs a concrete size from its child.)

- [ ] **Step 3: `profile_screen.dart` (driver), line 34** (detail shape — identical structure to Task 3's client edit):
```dart
          ? const Center(child: CircularProgressIndicator())
```
becomes:
```dart
          ? const KayaSkeletonCard()
```

- [ ] **Step 4: `earnings_screen.dart`, line 107** (list shape — transactions):
```dart
              loading: () => const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
              loading: () => const KayaSkeletonList(),
```

- [ ] **Step 5: `active_delivery_screen.dart`, line 64** (detail shape — one delivery):
```dart
        loading: () => const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
        loading: () => const KayaSkeletonCard(),
```

- [ ] **Step 6: `notifications_screen.dart` (driver), line 25** (list shape — identical to the client's notifications screen):
```dart
        loading: () => const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
        loading: () => const KayaSkeletonList(),
```

- [ ] **Step 7: `propose_price_screen.dart`, line 62** (detail shape — one order, before proposing a price):
```dart
        loading: () => const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
        loading: () => const KayaSkeletonCard(),
```

- [ ] **Step 8: `delivery_history_screen.dart`, line 27** (list shape — past deliveries):
```dart
        loading: () => const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
        loading: () => const KayaSkeletonList(),
```

- [ ] **Step 9: `delivery_detail_screen.dart`, line 28** (detail shape — one delivery's commission breakdown):
```dart
        loading: () => const Center(child: CircularProgressIndicator()),
```
becomes:
```dart
        loading: () => const KayaSkeletonCard(),
```

- [ ] **Step 10: Verify**

Run:
```bash
cd apps/driver
grep -rn "CircularProgressIndicator" lib/features/stats lib/features/profile lib/features/earnings lib/features/delivery lib/features/notifications lib/features/offer lib/features/history
```
Expected: no output.

```bash
grep -n "CircularProgressIndicator" lib/features/home/driver_home_screen.dart
```
Expected: exactly one match — the online/offline toggle busy-spinner at what was originally line 152 (Global Constraints exclusion #3; unaffected by this task's Step 2, which touched a different spinner in the same file).

Then, from the repo root, the whole-plan gate:
```bash
cd packages/kaya_core && flutter test && flutter analyze
cd ../../apps/client && flutter test && flutter analyze
cd ../driver && flutter test && flutter analyze
```
Expected: all green. This closes out Wave 2c.

- [ ] **Step 11: Commit**

```bash
git add apps/driver/lib/features/stats/stats_screen.dart apps/driver/lib/features/home/driver_home_screen.dart apps/driver/lib/features/profile/profile_screen.dart apps/driver/lib/features/earnings/earnings_screen.dart apps/driver/lib/features/delivery/active_delivery_screen.dart apps/driver/lib/features/notifications/notifications_screen.dart apps/driver/lib/features/offer/propose_price_screen.dart apps/driver/lib/features/history/delivery_history_screen.dart apps/driver/lib/features/history/delivery_detail_screen.dart
git commit -m "feat(driver): replace remaining loading spinners with KayaSkeletonList/KayaSkeletonCard"
```
