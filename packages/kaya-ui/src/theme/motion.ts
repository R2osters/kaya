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

/**
 * The gap between one list item's entrance and the next.
 *
 * A list that fades in as a single block reads as one object appearing; the
 * same list staggered reads as several, which is what it is. Kept small on
 * purpose: at 40ms a five-row list is fully in within 200ms, so the stagger
 * is felt as texture rather than waited through.
 */
export const STAGGER_MS = 40;

/**
 * The stagger stops accumulating past this rank. Without a cap, row 30 of a
 * history list would wait 1.2s to appear — the effect that reads as
 * "considered" at the top of a list reads as broken further down, and
 * anything below the fold has no entrance to make anyway.
 */
export const STAGGER_MAX_STEPS = 6;

/**
 * How long an element takes to arrive (fade + rise). Longer than the press
 * response because nothing is waiting on it: an entrance is allowed to be
 * seen, whereas feedback must be instantaneous.
 */
export const ENTER_MS = 260;

/**
 * Progress that advances on its own — a delivery moving from picked-up to
 * in-transit, a wizard step completing.
 *
 * Slower than `springs.settle`, deliberately: this is the one piece of motion
 * in the app that carries information rather than acknowledging input. The
 * fill has to be watchable — a status change that snaps into place is
 * indistinguishable from a re-render, and the client watching a timeline is
 * exactly the person who needs to see that something moved.
 */
export const progress = Object.freeze({
  duration: 550,
  dampingRatio: 1,
}) satisfies WithSpringConfig;
