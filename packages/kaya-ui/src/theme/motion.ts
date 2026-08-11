import type { WithSpringConfig, WithTimingConfig } from "react-native-reanimated";
import { Easing } from "react-native-reanimated";

/**
 * Motion tokens. Springs, not durations, for anything a finger touches —
 * a spring animates from the current value and can be grabbed mid-flight,
 * which is what makes an interface feel physical rather than scripted.
 *
 * The values follow Apple's damping-ratio / response pairing (Designing Fluid
 * Interfaces, WWDC 2018), which Reanimated expresses directly as
 * `{ duration, dampingRatio }`:
 *
 *  - damping 1.0 = critically damped, settles with no overshoot. The default
 *    for UI that merely appears or returns: overshoot on a menu that just
 *    faded in feels wrong.
 *  - damping ~0.8 = slight overshoot. Reserved for motion that inherits the
 *    user's momentum — a released drag, a sheet flicked closed — where a
 *    little bounce reads as the energy the gesture put in.
 *
 * `response` (the duration field) is how fast the value closes on the target,
 * not a fixed clip length; a spring has no fixed end.
 */
export const springs = Object.freeze({
  /** Press feedback returning to rest. Snappy, no bounce. */
  press: Object.freeze({ duration: 300, dampingRatio: 1 }) satisfies WithSpringConfig,
  /** Standard UI settle — reposition, selection, reveal. */
  settle: Object.freeze({ duration: 400, dampingRatio: 1 }) satisfies WithSpringConfig,
  /** Momentum carriers: sheets, drags, flicks. Slight overshoot on purpose. */
  sheet: Object.freeze({ duration: 300, dampingRatio: 0.8 }) satisfies WithSpringConfig,
} as const);

/**
 * The one timing token: press-down. Feedback on the way *in* must be
 * instantaneous and monotonic — a spring's settle would delay the very signal
 * ("I felt that") the animation exists to send. ~100ms ease-out, per the
 * respond-on-pointer-down rule.
 */
export const pressIn = Object.freeze({
  duration: 100,
  easing: Easing.out(Easing.quad),
}) satisfies WithTimingConfig;

/** How far a pressed control sinks. Visible, not cartoonish. */
export const PRESS_SCALE = 0.97;
