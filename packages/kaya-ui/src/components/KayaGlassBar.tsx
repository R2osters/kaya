import type { ComponentType, ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, shadows } from "../theme";

export interface BlurSurfaceProps {
  /** 0–100, the scale expo-blur uses. The design calls for 40. */
  intensity: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** The shape a host app's blur implementation must satisfy to be registered. */
export type BlurProviderComponent = ComponentType<BlurSurfaceProps>;

let registeredBlur: BlurProviderComponent | null = null;

/**
 * Host apps call this once at startup to plug in a real blur implementation —
 * `expo-blur`'s `BlurView`, in practice:
 *
 * ```ts
 * import { BlurView } from "expo-blur";
 * registerBlurProvider(BlurView);
 * ```
 *
 * Until one is registered — and none is today, because `expo-blur` is a native
 * module and adding one invalidates every installed dev client until it is
 * rebuilt — every glass surface renders the design's own documented fallback:
 * an opaque surface with a hairline border. That fallback is not a stand-in
 * for the real thing so much as the Android answer to it: blur is expensive on
 * the mid-range hardware this app targets, and a translucent bar over a moving
 * map is where it is most expensive.
 *
 * Mirrors `registerMapProvider` deliberately: same seam, same single slot,
 * same reason.
 */
export function registerBlurProvider(provider: BlurProviderComponent): void {
  registeredBlur = provider;
}

/** Whether a real blur implementation has been registered. */
export function hasBlurProvider(): boolean {
  return registeredBlur !== null;
}

/** Clears the registration. For tests; a running app registers once. */
export function resetBlurProvider(): void {
  registeredBlur = null;
}

export interface KayaGlassBarProps {
  children: ReactNode;
  /** Corner radius. Search bars take 16, floating pills take the pill radius. */
  radius?: number;
  /** Drops the shadow, for glass that sits inside another shadowed surface. */
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The blur strength the design specifies, on expo-blur's 0–100 scale. */
const GLASS_INTENSITY = 40;

/**
 * A surface that floats over content — the search bar on the client's map, the
 * ETA pill on the tracking screen, a sheet's handle.
 *
 * Glass earns its place in exactly three spots in this design and nowhere
 * else, which is the whole discipline: a translucent panel says "there is
 * something live underneath this", and it stops saying anything once every
 * panel is translucent. Everything not floating over the map is a KayaCard.
 *
 * Either way the contract is the same: text on it stays legible, because the
 * fallback is fully opaque and the blurred version sits on a 78%-white tint
 * rather than on clear glass.
 */
export function KayaGlassBar({
  children,
  radius = radii.button,
  shadow = true,
  style,
  testID,
}: KayaGlassBarProps) {
  const shape: ViewStyle = {
    borderRadius: radius,
    ...(shadow ? shadows.card : null),
  };

  if (registeredBlur !== null) {
    const Blur = registeredBlur;
    return (
      <View style={[styles.clip, shape, style]} testID={testID}>
        <Blur intensity={GLASS_INTENSITY} style={[StyleSheet.absoluteFill, styles.tint]} />
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.fallback, shape, style]} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Clipping is required only on the blurred path, where a child layer has to
  // be cut to the rounded shape. KayaCard deliberately avoids `overflow` for
  // shadow reasons; here the shadow sits on this same view and iOS would clip
  // it, so the blurred variant accepts a flatter shadow in exchange for a
  // correctly rounded blur.
  clip: { overflow: "hidden" },
  tint: { backgroundColor: colors.glassTint },
  fallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
});
