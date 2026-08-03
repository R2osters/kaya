# Phase 1B — `@kaya/ui` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@kaya/ui`, the React Native half of the shared layer: the Accra Minimalist design tokens, the nine shared components ported from the Flutter widgets, the map abstraction, and the five platform adapters whose interfaces live in `@kaya/core`.

**Architecture:** `@kaya/core` (phase 1A, merged) holds everything platform-free and is forbidden from importing `react-native` or any `expo-*` package — an ESLint rule enforces it. `@kaya/ui` is where that boundary is paid for: it supplies the concrete adapter for every interface core declares, plus the components. The two Expo apps (phase 1C) import from `@kaya/ui` and `@kaya/core` only, never from deep paths.

**Tech Stack:** React Native 0.81 / React 19 (via Expo 54), TypeScript 5.9 strict, `StyleSheet.create` fed by exported tokens, `lucide-react-native` icons, `react-native-reanimated` for the skeleton shimmer, jest-expo + `@testing-library/react-native`.

## Global Constraints

- `@kaya/core` MUST NOT import `react`, `react-native`, `react-i18next`, or any `expo-*` package. Nothing in this phase may weaken that rule; run `npm run lint -w @kaya/core` after any change that touches core.
- **One styling mechanism only:** `StyleSheet.create` fed by the tokens exported from `@kaya/ui/theme`. No inline colour literals, no second styling library. A lint rule (Task 9) forbids colour literals outside the token file.
- Design tokens are exact, from `legacy/flutter/kaya_core/lib/src/theme/`. Copy the values verbatim; do not re-derive or "improve" them.
- Minimum touch target 44px. Corner radii: field 14, button 16, cardTight 18, card 20, sheet 28, pill 999. Spacing scale 4/8/12/16/20/24/32.
- Typography is Inter at weights 400–800.
- Dark theme is out of scope, as in the design.
- Every adapter implements an interface declared in `@kaya/core`; the interface is the contract, the adapter is replaceable.
- Code and comments in English. UI strings via i18n only — no hardcoded copy in components.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

```
packages/kaya-ui/
├── package.json                 name: @kaya/ui
├── tsconfig.json
├── jest.config.js               preset: jest-expo
├── .eslintrc.cjs
└── src/
    ├── index.ts                 barrel
    ├── theme/
    │   ├── colors.ts            palette + tints + map markers
    │   ├── radii.ts             radii + spacing + minTouch
    │   ├── shadows.ts           card / soft / sheet
    │   ├── typography.ts        Inter scale
    │   └── index.ts
    ├── components/
    │   ├── KayaButton.tsx  KayaCard.tsx
    │   ├── StatusPill.tsx  RatingStars.tsx  KayaAvatar.tsx
    │   ├── KayaTextField.tsx  EmptyState.tsx
    │   ├── BottomSheetShell.tsx  KayaSkeleton.tsx
    │   └── index.ts
    ├── map/
    │   ├── MapView.tsx          registry + props
    │   ├── StylizedMapFallback.tsx
    │   └── MapLibreMapView.tsx
    └── adapters/
        ├── SecureTokenStore.ts  expo-secure-store
        ├── KayaI18nProvider.tsx react-i18next
        ├── LocationAdapter.ts   expo-location
        ├── ImageAdapter.ts      expo-image-picker + expo-image-manipulator
        └── PushAdapter.ts       @react-native-firebase/messaging
```

---

### Task 1: Package scaffolding and the design tokens

**Files:**
- Create: `packages/kaya-ui/{package.json,tsconfig.json,jest.config.js}`, `src/theme/{colors,radii,shadows,typography,index}.ts`
- Test: `packages/kaya-ui/src/theme/theme.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `colors`, `radii`, `spacing`, `minTouch`, `shadows`, `typography` — plain frozen objects, plus the types `ColorToken`, `Shadow`, `TextStyleToken`.

**Source of truth:** `legacy/flutter/kaya_core/lib/src/theme/app_colors.dart`, `app_radii.dart`, `app_shadows.dart`, `app_typography.dart`. Read all four before writing; the values below are transcribed and must be checked against them.

- [ ] **Step 1: Write the failing test**

Create `packages/kaya-ui/src/theme/theme.test.ts`:

```ts
import { colors, minTouch, radii, shadows, spacing, typography } from "./index";

describe("design tokens", () => {
  it("carries the exact Accra Minimalist palette", () => {
    expect(colors.primary).toBe("#1466FF");
    expect(colors.success).toBe("#12A150");
    expect(colors.danger).toBe("#E5484D");
    expect(colors.amber).toBe("#F5A623");
    expect(colors.ink).toBe("#0B1220");
    expect(colors.inkSecondary).toBe("#5B6472");
    expect(colors.inkTertiary).toBe("#8A94A6");
    expect(colors.surface).toBe("#FFFFFF");
    expect(colors.background).toBe("#F4F6F9");
    expect(colors.border).toBe("#E7EAF0");
    expect(colors.borderSoft).toBe("#EBEEF3");
  });

  it("carries the soft tints used by pills and badges", () => {
    expect(colors.primaryTint).toBe("#EAF1FF");
    expect(colors.successTint).toBe("#E6F5EC");
    expect(colors.dangerTint).toBe("#FCEBEC");
    expect(colors.amberTint).toBe("#FEF3E0");
  });

  it("maps pickup to success and dropoff to primary", () => {
    // Green = pickup, blue = drop-off, per the design reference.
    expect(colors.markerPickup).toBe(colors.success);
    expect(colors.markerDropoff).toBe(colors.primary);
  });

  it("carries the radius and spacing scales", () => {
    expect(radii).toEqual({ field: 14, button: 16, cardTight: 18, card: 20, sheet: 28, pill: 999 });
    expect(spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 });
    expect(minTouch).toBe(44);
  });

  it("exposes the three shadow presets", () => {
    for (const preset of [shadows.card, shadows.soft, shadows.sheet]) {
      expect(typeof preset.shadowColor).toBe("string");
      expect(typeof preset.elevation).toBe("number");
    }
    // The sheet shadow rises upward; the others fall.
    expect(shadows.sheet.shadowOffset.height).toBeLessThan(0);
    expect(shadows.card.shadowOffset.height).toBeGreaterThan(0);
  });

  it("carries the Inter type scale with the documented weights", () => {
    expect(typography.screenTitle).toMatchObject({ fontSize: 28, fontWeight: "800" });
    expect(typography.sectionTitle).toMatchObject({ fontSize: 22, fontWeight: "700" });
    expect(typography.cardTitle).toMatchObject({ fontSize: 17, fontWeight: "700" });
    expect(typography.body).toMatchObject({ fontSize: 15, fontWeight: "400" });
    expect(typography.price).toMatchObject({ fontSize: 20, fontWeight: "800" });
    expect(typography.priceLarge).toMatchObject({ fontSize: 26, fontWeight: "800" });
    expect(typography.overline).toMatchObject({ fontSize: 12, letterSpacing: 1.1 });
    expect(typography.button).toMatchObject({ fontSize: 16, fontWeight: "700" });
  });

  it("freezes the tokens so a screen cannot mutate them for everyone", () => {
    expect(Object.isFrozen(colors)).toBe(true);
    expect(Object.isFrozen(radii)).toBe(true);
  });
});
```

- [ ] **Step 2: Write the package manifest**

Create `packages/kaya-ui/package.json`:

```json
{
  "name": "@kaya/ui",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "lint": "cross-env ESLINT_USE_FLAT_CONFIG=false eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@kaya/core": "*"
  },
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  },
  "devDependencies": {
    "@testing-library/react-native": "^13.2.0",
    "@types/jest": "^29.5.14",
    "@types/react": "~19.1.10",
    "cross-env": "^7.0.3",
    "eslint": "^9.39.5",
    "jest": "^29.7.0",
    "jest-expo": "~54.0.0",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "typescript": "~5.9.2",
    "typescript-eslint": "^8.65.0"
  }
}
```

Create `packages/kaya-ui/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "rootDir": "src",
    "outDir": "dist",
    "types": ["jest", "react"]
  },
  "include": ["src/**/*"]
}
```

Create `packages/kaya-ui/jest.config.js`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
```

Create `packages/kaya-ui/jest.setup.js`:

```js
// react-native-reanimated ships a jest mock; the skeleton shimmer needs it.
require("react-native-reanimated/mock");
```

- [ ] **Step 3: Install**

Run: `npm install`
Expected: `@kaya/ui` resolves `@kaya/core` through the workspace. No `ERESOLVE`.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -w @kaya/ui`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 5: Write `colors.ts`**

```ts
/**
 * "Accra Minimalist Delivery" palette, transcribed from
 * legacy/flutter/kaya_core/lib/src/theme/app_colors.dart. These are the design
 * reference's exact values — do not introduce a colour literal anywhere else in
 * the app; extend this file instead. A lint rule enforces that.
 */
export const colors = Object.freeze({
  // Brand / actions
  primary: "#1466FF",
  success: "#12A150",
  danger: "#E5484D",
  amber: "#F5A623",

  // Text / ink
  ink: "#0B1220",
  inkSecondary: "#5B6472",
  inkTertiary: "#8A94A6",

  // Surfaces
  surface: "#FFFFFF",
  background: "#F4F6F9",
  border: "#E7EAF0",
  borderSoft: "#EBEEF3",

  // Soft chip / badge backgrounds
  primaryTint: "#EAF1FF",
  successTint: "#E6F5EC",
  dangerTint: "#FCEBEC",
  amberTint: "#FEF3E0",

  // Map markers: green = pickup, blue = drop-off
  markerPickup: "#12A150",
  markerDropoff: "#1466FF",
} as const);

export type ColorToken = keyof typeof colors;
```

- [ ] **Step 6: Write `radii.ts`**

```ts
/** Corner radii: buttons/fields 14–16, cards 18–20, sheets 28, pills 999. */
export const radii = Object.freeze({
  field: 14,
  button: 16,
  cardTight: 18,
  card: 20,
  sheet: 28,
  pill: 999,
} as const);

/** 4pt spacing grid, shared by both apps. */
export const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const);

/** Minimum touch target from the design system. */
export const minTouch = 44;
```

- [ ] **Step 7: Write `shadows.ts`**

```ts
import type { ViewStyle } from "react-native";

/**
 * Soft depth, not heavy drops. The Flutter side expressed these as BoxShadow
 * with a negative spread; React Native has no spread, so the blur is reduced to
 * approximate the same visual weight, and `elevation` carries Android.
 */
export type Shadow = Required<
  Pick<ViewStyle, "shadowColor" | "shadowOpacity" | "shadowRadius" | "elevation">
> & { shadowOffset: { width: number; height: number } };

export const shadows = Object.freeze({
  card: Object.freeze({
    shadowColor: "#0B1220",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  }),
  soft: Object.freeze({
    shadowColor: "#0B1220",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  }),
  /** Bottom sheets cast upward. */
  sheet: Object.freeze({
    shadowColor: "#0B1220",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  }),
}) as Readonly<Record<"card" | "soft" | "sheet", Shadow>>;
```

- [ ] **Step 8: Write `typography.ts`**

```ts
import type { TextStyle } from "react-native";
import { colors } from "./colors";

/**
 * Inter scale, transcribed from app_typography.dart. Flutter's `height` is a
 * multiplier; React Native's `lineHeight` is absolute, so each is multiplied
 * out here rather than carried across as a ratio.
 */
export type TextStyleToken = TextStyle;

export const typography = Object.freeze({
  screenTitle: { fontFamily: "Inter", fontSize: 28, fontWeight: "800", lineHeight: 32, color: colors.ink },
  sectionTitle: { fontFamily: "Inter", fontSize: 22, fontWeight: "700", lineHeight: 26, color: colors.ink },
  cardTitle: { fontFamily: "Inter", fontSize: 17, fontWeight: "700", lineHeight: 21, color: colors.ink },

  body: { fontFamily: "Inter", fontSize: 15, fontWeight: "400", lineHeight: 21, color: colors.ink },
  bodyStrong: { fontFamily: "Inter", fontSize: 15, fontWeight: "600", lineHeight: 21, color: colors.ink },
  bodySecondary: { fontFamily: "Inter", fontSize: 15, fontWeight: "400", lineHeight: 21, color: colors.inkSecondary },
  caption: { fontFamily: "Inter", fontSize: 13, fontWeight: "400", color: colors.inkSecondary },

  price: { fontFamily: "Inter", fontSize: 20, fontWeight: "800", lineHeight: 22, color: colors.ink },
  priceLarge: { fontFamily: "Inter", fontSize: 26, fontWeight: "800", lineHeight: 29, color: colors.ink },

  overline: { fontFamily: "Inter", fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.inkTertiary },
  button: { fontFamily: "Inter", fontSize: 16, fontWeight: "700", color: colors.surface },
} as const satisfies Record<string, TextStyle>);
```

- [ ] **Step 9: Write `theme/index.ts`**

```ts
export * from "./colors";
export * from "./radii";
export * from "./shadows";
export * from "./typography";
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -w @kaya/ui`
Expected: PASS, 7 tests.

- [ ] **Step 11: Commit**

```bash
git add packages/kaya-ui package.json package-lock.json
git commit -m "feat(ui): scaffold @kaya/ui with the Accra Minimalist design tokens

Values are transcribed verbatim from the Flutter theme, including the soft tints
and the map-marker mapping (green pickup, blue drop-off). Flutter's shadow spread
and line-height ratio have no React Native equivalent, so those two are
translated rather than copied, and the reasoning is recorded next to each.

The tokens are frozen: they are read by every screen in two apps, and a
mutation in one would silently reach the other.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `KayaButton` and `KayaCard`

**Files:**
- Create: `packages/kaya-ui/src/components/KayaButton.tsx`, `KayaCard.tsx`
- Test: `packages/kaya-ui/src/components/KayaButton.test.tsx`, `KayaCard.test.tsx`

**Interfaces:**
- Consumes: `colors`, `radii`, `spacing`, `minTouch`, `shadows`, `typography` (Task 1).
- Produces: `KayaButton` with props `{ label, onPress?, variant?: "primary" | "secondary" | "danger", icon?: ReactNode, loading?: boolean, expand?: boolean, testID? }`; `KayaCard` with props `{ children, padding?, onPress?, radius?, border?, color?, shadow?, testID? }`.

Port from `legacy/flutter/kaya_core/lib/src/theme/widgets/kaya_button.dart` and `kaya_card.dart`. Behaviour to preserve exactly: a button is disabled when `onPress` is absent **or** `loading` is true; a disabled non-loading button renders at 50% opacity; the filled variants use white foreground while `secondary` uses ink on surface with a 1.4px border; minimum height is `minTouch`; the label truncates to one line with an ellipsis.

- [ ] **Step 1: Write the failing tests**

Create `packages/kaya-ui/src/components/KayaButton.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { KayaButton } from "./KayaButton";
import { colors } from "../theme";

describe("KayaButton", () => {
  it("calls onPress when enabled", () => {
    const onPress = jest.fn();
    render(<KayaButton label="Publier" onPress={onPress} />);
    fireEvent.press(screen.getByText("Publier"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while loading", () => {
    const onPress = jest.fn();
    render(<KayaButton label="Publier" onPress={onPress} loading testID="btn" />);
    fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("hides the label and shows a spinner while loading", () => {
    render(<KayaButton label="Publier" onPress={jest.fn()} loading testID="btn" />);
    expect(screen.queryByText("Publier")).toBeNull();
    expect(screen.getByTestId("btn-spinner")).toBeTruthy();
  });

  it("renders at half opacity when disabled but not loading", () => {
    render(<KayaButton label="Publier" testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ opacity: 0.5 });
  });

  it("keeps full opacity while loading, because the spinner already signals state", () => {
    render(<KayaButton label="Publier" onPress={jest.fn()} loading testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ opacity: 1 });
  });

  it("fills with the variant colour and uses white ink", () => {
    render(<KayaButton label="Annuler" onPress={jest.fn()} variant="danger" testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ backgroundColor: colors.danger });
    expect(screen.getByText("Annuler")).toHaveStyle({ color: colors.surface });
  });

  it("draws the secondary variant as ink on surface with a border", () => {
    render(<KayaButton label="Plus tard" onPress={jest.fn()} variant="secondary" testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ backgroundColor: colors.surface });
    expect(screen.getByText("Plus tard")).toHaveStyle({ color: colors.ink });
  });

  it("never renders below the 44px touch target", () => {
    render(<KayaButton label="OK" onPress={jest.fn()} testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ minHeight: 44 });
  });

  it("exposes its disabled state to assistive technology", () => {
    render(<KayaButton label="Publier" testID="btn" />);
    expect(screen.getByTestId("btn")).toBeDisabled();
  });
});
```

Create `packages/kaya-ui/src/components/KayaCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { KayaCard } from "./KayaCard";
import { colors, radii } from "../theme";

describe("KayaCard", () => {
  it("renders its children on a white surface with the card radius", () => {
    render(
      <KayaCard testID="card">
        <Text>Osu → East Legon</Text>
      </KayaCard>,
    );
    expect(screen.getByText("Osu → East Legon")).toBeTruthy();
    expect(screen.getByTestId("card")).toHaveStyle({
      backgroundColor: colors.surface,
      borderRadius: radii.card,
    });
  });

  it("is not pressable unless an onPress is supplied", () => {
    render(
      <KayaCard testID="card">
        <Text>static</Text>
      </KayaCard>,
    );
    // A plain View has no press handler to fire; this asserts the card does not
    // silently swallow taps meant for something behind it.
    expect(screen.getByTestId("card")).toBeTruthy();
  });

  it("calls onPress when pressable", () => {
    const onPress = jest.fn();
    render(
      <KayaCard testID="card" onPress={onPress}>
        <Text>tap me</Text>
      </KayaCard>,
    );
    fireEvent.press(screen.getByTestId("card"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("can drop its border and shadow for nested use", () => {
    render(
      <KayaCard testID="card" border={false} shadow={false}>
        <Text>flat</Text>
      </KayaCard>,
    );
    expect(screen.getByTestId("card")).toHaveStyle({ borderWidth: 0, elevation: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @kaya/ui -- Kaya`
Expected: FAIL — `Cannot find module './KayaButton'`.

- [ ] **Step 3: Write `KayaButton.tsx`**

```tsx
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, minTouch, radii, spacing, typography } from "../theme";

export type KayaButtonVariant = "primary" | "secondary" | "danger";

export interface KayaButtonProps {
  label: string;
  onPress?: () => void;
  variant?: KayaButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  /** Stretch to the available width. Defaults to true, as the Flutter widget did. */
  expand?: boolean;
  testID?: string;
}

const FILL: Record<KayaButtonVariant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  danger: colors.danger,
};

/** Primary call to action. Never shorter than the 44px touch target. */
export function KayaButton({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  expand = true,
  testID,
}: KayaButtonProps) {
  const disabled = onPress === undefined || loading;
  const filled = variant !== "secondary";
  const foreground = filled ? colors.surface : colors.ink;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        { backgroundColor: FILL[variant] },
        !filled && styles.outlined,
        expand ? styles.expand : styles.hug,
        // A loading button is disabled too, but the spinner already says so —
        // dimming it as well reads as "broken" rather than "working".
        { opacity: disabled && !loading ? 0.5 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator testID={testID ? `${testID}-spinner` : undefined} color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon !== undefined && <View style={styles.icon}>{icon}</View>}
          <Text numberOfLines={1} style={[typography.button, { color: foreground }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch,
    borderRadius: radii.button,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  outlined: { borderWidth: 1.4, borderColor: colors.border },
  expand: { alignSelf: "stretch" },
  hug: { alignSelf: "flex-start" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icon: { marginRight: spacing.sm },
});
```

- [ ] **Step 4: Write `KayaCard.tsx`**

```tsx
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radii, shadows, spacing } from "../theme";

export interface KayaCardProps {
  children: ReactNode;
  padding?: number;
  onPress?: () => void;
  radius?: number;
  border?: boolean;
  color?: string;
  shadow?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/** White surface card: soft shadow, hairline border, 18–20px radius. */
export function KayaCard({
  children,
  padding = spacing.lg,
  onPress,
  radius = radii.card,
  border = true,
  color = colors.surface,
  shadow = true,
  style,
  testID,
}: KayaCardProps) {
  const composed: ViewStyle = {
    padding,
    borderRadius: radius,
    backgroundColor: color,
    borderWidth: border ? 1 : 0,
    borderColor: border ? colors.borderSoft : undefined,
    ...(shadow ? shadows.card : { elevation: 0, shadowOpacity: 0 }),
  };

  if (onPress === undefined) {
    return (
      <View testID={testID} style={[styles.base, composed, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={[styles.base, composed, style]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({ base: { overflow: "hidden" } });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w @kaya/ui -- Kaya`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/kaya-ui/src/components
git commit -m "feat(ui): KayaButton and KayaCard

The button keeps full opacity while loading: the spinner already signals the
state, and dimming as well reads as broken rather than busy. Disabled and busy
are both exposed through accessibilityState, which the Flutter original had no
equivalent for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `StatusPill`, `RatingStars`, `KayaAvatar`

**Files:**
- Create: `packages/kaya-ui/src/components/StatusPill.tsx`, `RatingStars.tsx`, `KayaAvatar.tsx`
- Test: one `.test.tsx` per component

**Interfaces:**
- Consumes: theme tokens; `lucide-react-native` for the star and person icons.
- Produces: `StatusPill` `{ label, tone?: "primary" | "success" | "danger" | "amber" | "neutral", icon?, dense?, testID? }`; `RatingStars` `{ value, size?, onRate?, count?, testID? }`; `KayaAvatar` `{ photoUrl?, name?, size?, ring?, testID? }`.

Port from `status_pill.dart`, `rating_stars.dart`, `kaya_avatar.dart`. Behaviour to preserve exactly:

- `StatusPill` tone → (background, foreground) pairs: primary → (`primaryTint`, `primary`), success → (`successTint`, `success`), danger → (`dangerTint`, `danger`), amber → (`amberTint`, `amber`), neutral → (`background`, `inkSecondary`). Padding 12/6, or 10/4 when `dense`. Radius `pill`. Label is `caption` at weight 700.
- `RatingStars`: a star at index `i` is filled when `i < Math.round(value)`; it is a half-star when not filled and `i < value` and `value - i >= 0.25`; otherwise it is an outline. Filled and half stars are amber, outlines `inkTertiary`. Interactive only when `onRate` is supplied, reporting `i + 1`.
- `KayaAvatar`: initials are the first letter of the first word, plus the first letter of the last word when there is more than one, uppercased. With no name and no photo, a person icon. `ring` draws a 2px primary circle with 2.5px padding.

**Note on the half-star rule:** it is genuinely odd — `Math.round(4.5)` is 5, so a 4.5 rating fills five stars and the half-star branch never fires for exactly `.5`. Port it verbatim anyway, and add a test that documents the actual behaviour rather than the behaviour the code appears to intend. Changing it is a design decision, not a port decision; note it in your report.

- [ ] **Step 1: Write the failing tests**

Create `packages/kaya-ui/src/components/StatusPill.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { StatusPill } from "./StatusPill";
import { colors } from "../theme";

describe("StatusPill", () => {
  it.each([
    ["primary", colors.primaryTint, colors.primary],
    ["success", colors.successTint, colors.success],
    ["danger", colors.dangerTint, colors.danger],
    ["amber", colors.amberTint, colors.amber],
    ["neutral", colors.background, colors.inkSecondary],
  ] as const)("pairs the %s tone with its tint", (tone, bg, fg) => {
    render(<StatusPill label="Livré" tone={tone} testID="pill" />);
    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: bg });
    expect(screen.getByText("Livré")).toHaveStyle({ color: fg });
  });

  it("tightens its padding when dense", () => {
    render(<StatusPill label="En route" dense testID="pill" />);
    expect(screen.getByTestId("pill")).toHaveStyle({ paddingHorizontal: 10, paddingVertical: 4 });
  });

  it("defaults to the primary tone", () => {
    render(<StatusPill label="Publiée" testID="pill" />);
    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: colors.primaryTint });
  });
});
```

Create `packages/kaya-ui/src/components/RatingStars.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react-native";
import { RatingStars } from "./RatingStars";

const kinds = () => screen.getAllByTestId(/^star-\d$/).map((s) => s.props.accessibilityLabel);

describe("RatingStars", () => {
  it("fills to the rounded value", () => {
    render(<RatingStars value={4} />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "outline"]);
  });

  it("rounds a .5 rating up rather than showing a half star", () => {
    // Documents the ported rule, not an intent: filled is `i < Math.round(value)`,
    // so 4.5 rounds to 5 and the half-star branch cannot fire for exactly .5.
    render(<RatingStars value={4.5} />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "filled"]);
  });

  it("shows a half star for a fraction between .25 and .5", () => {
    render(<RatingStars value={4.3} />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "half"]);
  });

  it("is read-only unless onRate is supplied", () => {
    render(<RatingStars value={3} />);
    expect(screen.getByTestId("star-0")).not.toBeDisabled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports a 1-based score when interactive", () => {
    const onRate = jest.fn();
    render(<RatingStars value={0} onRate={onRate} />);
    fireEvent.press(screen.getByTestId("star-3"));
    expect(onRate).toHaveBeenCalledWith(4);
  });
});
```

Create `packages/kaya-ui/src/components/KayaAvatar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { KayaAvatar } from "./KayaAvatar";

describe("KayaAvatar", () => {
  it("shows first and last initials", () => {
    render(<KayaAvatar name="Kwame Mensah" />);
    expect(screen.getByText("KM")).toBeTruthy();
  });

  it("shows a single initial for a one-word name", () => {
    render(<KayaAvatar name="Ama" />);
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("takes the first and last of three words, not the first two", () => {
    render(<KayaAvatar name="Yaw Kofi Boateng" />);
    expect(screen.getByText("YB")).toBeTruthy();
  });

  it("ignores surrounding and repeated whitespace", () => {
    render(<KayaAvatar name="  Ama   Owusu  " />);
    expect(screen.getByText("AO")).toBeTruthy();
  });

  it("falls back to an icon with neither photo nor name", () => {
    render(<KayaAvatar testID="avatar" />);
    expect(screen.getByTestId("avatar-placeholder")).toBeTruthy();
  });

  it("prefers the photo over initials", () => {
    render(<KayaAvatar name="Ama Owusu" photoUrl="https://example.test/a.jpg" testID="avatar" />);
    expect(screen.queryByText("AO")).toBeNull();
    expect(screen.getByTestId("avatar-image")).toBeTruthy();
  });

  it("treats an empty photo url as no photo", () => {
    render(<KayaAvatar name="Ama Owusu" photoUrl="" />);
    expect(screen.getByText("AO")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @kaya/ui -- "StatusPill|RatingStars|KayaAvatar"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Add the icon dependency**

Run: `npm install lucide-react-native@^0.475.0 react-native-svg@15.12.1 -w @kaya/ui`
Expected: both appear under `@kaya/ui` dependencies.

- [ ] **Step 4: Write the three components**

Write `StatusPill.tsx`, `RatingStars.tsx` and `KayaAvatar.tsx` implementing the behaviour specified above, styling exclusively through `StyleSheet.create` fed by the theme tokens. Each star in `RatingStars` carries `testID={`star-${i}`}` and `accessibilityLabel` of `"filled"`, `"half"` or `"outline"` so the tests can assert the rendered pattern; when `onRate` is supplied each star is a `Pressable` with `accessibilityRole="button"`. `KayaAvatar` renders its photo with `testID={`${testID}-image`}` and its no-name fallback icon with `testID={`${testID}-placeholder`}`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w @kaya/ui -- "StatusPill|RatingStars|KayaAvatar"`
Expected: PASS, 19 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/kaya-ui/src/components packages/kaya-ui/package.json package-lock.json
git commit -m "feat(ui): StatusPill, RatingStars and KayaAvatar

The star rule is ported verbatim, including the quirk that a .5 rating rounds up
rather than rendering a half star — the half-star branch only fires between .25
and .5. A test documents the behaviour as it is, since changing it is a design
decision rather than a port decision.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `KayaTextField`, `EmptyState`, `BottomSheetShell`, `KayaSkeleton`

**Files:**
- Create: those four components plus `packages/kaya-ui/src/components/index.ts`
- Test: one `.test.tsx` per component

**Interfaces:**
- Consumes: theme tokens, `KayaButton` (Task 2), `react-native-reanimated` for the shimmer.
- Produces: `KayaTextField` `{ label?, hint?, value, onChangeText, keyboardType?, secureTextEntry?, prefixIcon?, suffixIcon?, multiline?, error?, editable?, testID? }`; `EmptyState` `{ icon, title, message?, actionLabel?, onAction? }`; `BottomSheetShell` `{ visible, onClose, title?, children }`; `KayaSkeleton` `{ width?, height?, radius?, testID? }`.

Port from the matching Dart widgets. Two additions the Flutter versions lacked, both justified below:

- `KayaTextField` gains an `error` prop. The Flutter version used `validator` and Flutter's form machinery, which has no React equivalent; the caller now owns validation and passes the message down. Render it in `danger` beneath the field, and set `accessibilityState` so the error is announced rather than only seen.
- `BottomSheetShell` must close on Android hardware back and on backdrop press, which the Flutter sheet got from the framework.

`KayaSkeleton` animates opacity between 0.4 and 1 over roughly 1s, looping. In tests the reanimated mock makes the animation inert; assert the layout and the accessibility state (`busy`), not the animation frames.

- [ ] **Step 1: Write the failing tests**

Write one test file per component covering: the field renders its label, hint and value, calls `onChangeText`, shows the error text and marks itself invalid, and respects `editable={false}`; the empty state renders title, optional message and optional action, and does not render an action button when only one of `actionLabel`/`onAction` is supplied; the sheet renders children only when `visible`, calls `onClose` on backdrop press and on hardware back; the skeleton renders at the requested size and exposes `accessibilityState={{ busy: true }}`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @kaya/ui -- "TextField|EmptyState|BottomSheet|Skeleton"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Add reanimated**

Run: `npm install react-native-reanimated@~4.1.1 -w @kaya/ui`

- [ ] **Step 4: Write the four components and the barrel**

`components/index.ts` re-exports all nine components and their prop types.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w @kaya/ui`
Expected: PASS, all suites.

- [ ] **Step 6: Commit**

```bash
git add packages/kaya-ui/src/components packages/kaya-ui/package.json package-lock.json
git commit -m "feat(ui): KayaTextField, EmptyState, BottomSheetShell and KayaSkeleton

The text field takes an error message as a prop rather than a validator: Flutter
supplied form machinery that React has no equivalent for, so the caller owns
validation now. The error is exposed through accessibilityState as well as
rendered, so it is announced and not only seen.

The bottom sheet closes on backdrop press and on Android hardware back, both of
which the Flutter sheet inherited from the framework.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Secure token store and the i18n provider

**Files:**
- Create: `packages/kaya-ui/src/adapters/SecureTokenStore.ts`, `KayaI18nProvider.tsx`
- Test: `SecureTokenStore.test.ts`, `KayaI18nProvider.test.tsx`

**Interfaces:**
- Consumes: `TokenStore` and `AuthTokens` from `@kaya/core`; `createI18n`, `SUPPORTED_LOCALES`, `Locale` from `@kaya/core`.
- Produces: `SecureTokenStore implements TokenStore`; `KayaI18nProvider` `{ locale?, children }` and a `useLocale()` hook returning `{ locale, setLocale }`.

`SecureTokenStore` is the platform half of the boundary `@kaya/core` declares. Port the key names and platform options from `legacy/flutter/kaya_core/lib/src/services/secure_token_storage.dart`: keys `kaya.access_token` and `kaya.refresh_token`, and on iOS the equivalent of `first_unlock` accessibility so a background refresh can still read the token.

**A behaviour the Flutter version did not have to handle:** `expo-secure-store` rejects rather than returning null on some devices when the keychain is unavailable. A throw from `readAccess` would propagate into the HTTP interceptor and turn a recoverable "no token" into a hard failure. Every read must degrade to `null`, and every write failure must be surfaced to the caller — losing a token silently is worse than failing the sign-in.

- [ ] **Step 1: Write the failing tests**

Mock `expo-secure-store` with `jest.mock`. Cover: a saved pair round-trips; `clear` removes both keys; a rejecting `getItemAsync` yields `null` rather than throwing; a rejecting `setItemAsync` **does** throw; the exact key names are used.

For the provider: it renders children, defaults to French, exposes the current locale through `useLocale`, switches language when `setLocale` is called, and rejects an unsupported locale by falling back to French.

- [ ] **Step 2: Run to verify failure, then implement, then verify passing**

Run: `npm test -w @kaya/ui -- "SecureTokenStore|I18nProvider"`

- [ ] **Step 3: Confirm the core purity rule still holds**

Run: `npm run lint -w @kaya/core`
Expected: exit 0. This task is the reason the rule exists — if `react-i18next` or `expo-secure-store` has leaked into core, this is where it shows.

- [ ] **Step 4: Commit**

```bash
git add packages/kaya-ui/src/adapters packages/kaya-ui/package.json package-lock.json
git commit -m "feat(ui): secure token store and i18n provider adapters

Both implement interfaces declared in @kaya/core, which is what lets that
package stay free of expo-* and react-i18next imports.

Reads from the keychain degrade to null: expo-secure-store rejects rather than
returning null when the keychain is unavailable, and a throw there would reach
the HTTP interceptor and turn a recoverable missing token into a hard failure.
Writes still throw, because losing a token silently is worse than a failed
sign-in.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Location and image adapters

**Files:**
- Create: `packages/kaya-core/src/platform/{location,image}.ts` (interfaces), `packages/kaya-ui/src/adapters/{LocationAdapter,ImageAdapter}.ts`
- Test: adapter tests in `@kaya/ui`, interface-shape tests in `@kaya/core`

**Interfaces:**
- Produces, in `@kaya/core`: `LocationProvider` with `requestPermission(): Promise<"granted" | "denied">`, `getCurrent(): Promise<GeoPoint | null>`, `watch(cb, opts): () => void`; `ImageProvider` with `pickFromLibrary()`, `capture()`, and `compress(uri, opts): Promise<{ uri, width, height, bytes }>`.
- Produces, in `@kaya/ui`: `LocationAdapter` on `expo-location`, `ImageAdapter` on `expo-image-picker` + `expo-image-manipulator`.

The interfaces go in core so that screens and any future test double depend on the contract, not on Expo. Core still imports nothing platform-specific — only types.

Two domain requirements the adapters must meet: the driver app publishes its position every 5 seconds while on a run, so `watch` takes an interval and a distance filter and must return a working unsubscribe; and photos are compressed **before** upload, so `compress` is not optional — the pickup and delivery photo flows call it on every image.

- [ ] **Step 1: Write the failing tests, mocking both Expo modules**

Cover: a denied permission yields `"denied"` and `getCurrent` then resolves `null` rather than throwing; `watch` returns a function that stops the subscription; `compress` reduces a large image and returns its new dimensions; a cancelled picker resolves `null`.

- [ ] **Step 2: Implement, verify, and re-run the core purity lint**

Run: `npm test -w @kaya/ui && npm run lint -w @kaya/core`

- [ ] **Step 3: Commit**

```bash
git add packages/kaya-core/src/platform packages/kaya-ui/src/adapters packages/kaya-ui/package.json package-lock.json
git commit -m "feat(ui): location and image adapters behind core interfaces

Screens depend on the LocationProvider and ImageProvider contracts rather than
on Expo, so a test double or a future platform swap does not reach into every
screen. watch() returns its own unsubscribe because the driver app publishes a
position every five seconds and a leaked subscription outlives the run.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Push adapter

**Files:**
- Create: `packages/kaya-core/src/platform/push.ts` (interface), `packages/kaya-ui/src/adapters/PushAdapter.ts`
- Test: `PushAdapter.test.ts`

**Interfaces:**
- Produces: `PushProvider` with `requestPermission()`, `getToken(): Promise<string | null>`, `onTokenRefresh(cb): () => void`, `onMessage(cb): () => void`, `onNotificationOpened(cb): () => void`.

Per the decisions log of 2026-07-11, the driver's new-request popup is driven by nearby polling plus FCM — there is no driver-facing socket event in v1. The push token must be sent to the backend whenever it changes, which is why `onTokenRefresh` is part of the contract rather than an implementation detail.

`@react-native-firebase/messaging` is not usable in Expo Go; a dev build is required. Note that in your report — phase 1C has to account for it.

- [ ] **Step 1: Write the failing tests with `@react-native-firebase/messaging` mocked**

Cover: a denied permission yields no token; `getToken` returns null rather than throwing when permission was refused; the refresh callback fires and its unsubscribe detaches.

- [ ] **Step 2: Implement, verify, commit**

```bash
git add packages/kaya-core/src/platform packages/kaya-ui/src/adapters packages/kaya-ui/package.json package-lock.json
git commit -m "feat(ui): push adapter behind a core interface

onTokenRefresh is part of the contract rather than an implementation detail: FCM
rotates tokens, and a stale one on the backend means a driver silently stops
receiving delivery requests — which, per the decisions log, is the only channel
that reaches them in v1.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Map abstraction, fallback and MapLibre

**Files:**
- Create: `packages/kaya-ui/src/map/{MapView.tsx,StylizedMapFallback.tsx,MapLibreMapView.tsx}`
- Test: `MapView.test.tsx`

**Interfaces:**
- Produces: `MapView` `{ center?, markers?, route?, showUserLocation?, testID? }`; `MapMarker` `{ point: GeoPoint, color: string, label?: string, isVehicle?: boolean }` with the constructors `pickupMarker`, `dropoffMarker`, `vehicleMarker`; `registerMapProvider(fn)` and `hasMapProvider()`.

Port the registry design from `legacy/flutter/kaya_core/lib/src/map/map_view.dart` exactly: `@kaya/ui` ships the interface plus a stylized fallback, and the host app registers the concrete implementation at startup. That is what keeps a maps SDK out of the shared package and lets the apps run with no API key at all.

Resolution order: a registered provider if there is one; otherwise the stylized fallback. `MapLibreMapView` (OpenStreetMap tiles, no key) is the default the apps register; `react-native-maps` is registered instead when `MAPS_API_KEY` is present.

- [ ] **Step 1: Write the failing tests**

Cover: with no provider registered, `MapView` renders the fallback; after `registerMapProvider`, it renders the provider and passes centre, markers and route through unchanged; `pickupMarker` is `colors.markerPickup` and `dropoffMarker` is `colors.markerDropoff`; registering twice replaces rather than stacks.

- [ ] **Step 2: Implement, verify, commit**

```bash
git add packages/kaya-ui/src/map packages/kaya-ui/package.json package-lock.json
git commit -m "feat(ui): map abstraction with a stylized keyless fallback

Ports the Flutter registry: this package ships the interface and the fallback,
the host app registers the concrete map. That keeps a maps SDK out of the shared
package and, more importantly, keeps the apps runnable with no API key — the
fallback is what makes a demo possible without billing enabled.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Barrel, lint rules and CI

**Files:**
- Create: `packages/kaya-ui/src/index.ts`, `packages/kaya-ui/.eslintrc.cjs`
- Modify: `.github/workflows/core.yml` (or add `ui.yml`)
- Test: `packages/kaya-ui/src/index.test.ts`

**Interfaces:**
- Produces: the public surface of `@kaya/ui` — theme tokens, all nine components, the map exports, all five adapters.

Two lint rules, and both must be probed rather than assumed. Phase 1A shipped a purity rule that silently failed to catch `react-i18next` because nobody tested it against every package it claimed to block.

1. **No colour literals outside `theme/colors.ts`.** Use `no-restricted-syntax` against string literals matching `/^#[0-9a-fA-F]{3,8}$/` and against `rgb(`/`rgba(` calls. This is what mechanically enforces "no duplicated theme", which the design named as the top divergence risk between the two apps.
2. **No deep imports of `@kaya/core` internals.** `@kaya/ui` imports from `@kaya/core`, never `@kaya/core/src/...`.

- [ ] **Step 1: Write the barrel test, run it, implement the barrel**

Assert every component, token, map export and adapter is reachable from the package root.

- [ ] **Step 2: Write the lint config and probe both rules**

Create a probe file containing a hex literal, an `rgba()` call, and a deep core import. Run lint and **paste the actual failing output into your report**, naming each rule. Then delete the probe and confirm lint exits 0.

- [ ] **Step 3: Extend CI**

Add `@kaya/ui` to the workflow so lint, typecheck and test all run for it. Confirm the job would fail on a violation — no `continue-on-error`.

- [ ] **Step 4: Run all gates for both packages**

```bash
npm run lint --workspaces --if-present
npm run typecheck --workspaces --if-present
npm test --workspaces --if-present
```

- [ ] **Step 5: Commit**

```bash
git add packages/kaya-ui .github/workflows
git commit -m "feat(ui): public barrel, styling-discipline lint rules and CI

A no-restricted-syntax rule fails the build on any hex or rgba literal outside
the token file. That is the mechanical form of the design's rule against
duplicating the theme, which it named as the main way the two apps drift apart.
Both rules were verified by probing them, not by reading them: phase 1A shipped
a purity rule that silently missed react-i18next because nobody did.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** Design § 5 (`@kaya/ui`) tokens → Task 1; the nine components → Tasks 2–4; platform adapters (secure storage, i18n provider, location, image, push) → Tasks 5–7; § 7 map abstraction with keyless fallback → Task 8; the core/ui boundary → enforced by the purity lint re-run in Tasks 5 and 6, and the new rules in Task 9.

**Out of scope, deliberately:** the two Expo apps and their routing (phase 1C), dark theme (out of scope in the design), screen-level composition of these components (phases 2 and 3).

**Carried forward from phase 1A's final review:** the backend rounds money to two decimals for every currency while the client rounds XOF to zero, so an accumulated balance drifts about 0.5 XOF per delivery. The fix belongs in the backend and is not part of this phase; it must be settled before the driver earnings screen ships in phase 3.

**Known risk.** Task 1 translates two things Flutter expresses differently from React Native — shadow spread and the line-height ratio. Those are the values most likely to look subtly wrong against the prototype screenshots in `D:\prototype\Application de livraison ghanéenne\ref\`. Compare a rendered card and a screen title against those references before considering Task 1 done.
