import type { GeoPoint } from "@kaya/core";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface SmoothedPointOptions {
  /**
   * How long the marker takes to travel to a newly received position.
   *
   * Deliberately much shorter than the ~5s between fixes. Gliding over the
   * full interval would look perfectly smooth and be perpetually five seconds
   * wrong — the marker would never once be where the driver is. Closing the
   * gap quickly and then holding still reads as "this is where they are, and
   * they are moving that way", which is the honest reading.
   */
  durationMs?: number;
  /**
   * Beyond this, the position is replaced rather than travelled to. A GPS
   * re-acquisition or a driver resuming after a tunnel produces a jump of
   * kilometres, and animating that draws a confident straight line through
   * streets nobody drove down.
   */
  snapAboveMeters?: number;
}

const DEFAULT_DURATION_MS = 900;
const DEFAULT_SNAP_ABOVE_M = 500;

/**
 * Commit interval. A map dot needs continuity, not 60fps: the interpolation is
 * driven from JavaScript and every step re-renders the marker's subtree, which
 * on the mid-range Android phones this app targets is the difference between a
 * smooth map and a map that stutters while it animates smoothness.
 */
const FRAME_MS = 50;

/** Metres per degree of latitude — near enough anywhere for a threshold test. */
const M_PER_DEG = 111_320;

/**
 * Straight-line distance in metres, flat-earth. Over the hundreds of metres
 * this is asked about, the error is centimetres, and the alternative
 * (haversine) buys nothing for a threshold comparison.
 */
function metresBetween(a: GeoPoint, b: GeoPoint): number {
  const latMid = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLat = (b.lat - a.lat) * M_PER_DEG;
  const dLng = (b.lng - a.lng) * M_PER_DEG * Math.cos(latMid);
  return Math.hypot(dLat, dLng);
}

/**
 * Turns a position that arrives in steps into one that moves.
 *
 * A driver's position reaches the client over the socket roughly every five
 * seconds, and the marker was rendered straight from it: the dot sat still,
 * teleported a block, sat still again. On a tracking screen whose entire job is
 * to answer "where are they now", a teleport reads as the app having lost them
 * and found them somewhere else.
 *
 * This interpolates between the last rendered position and the newly received
 * one, so the marker travels the gap. It stays a plain React value rather than
 * a shared value on purpose: it feeds a third-party map's `lngLat` prop, which
 * is a normal prop and cannot be driven from the UI thread.
 *
 * The first position is adopted outright — there is nowhere to travel from,
 * and a marker sliding in from the previous frame's nothing would be inventing
 * a journey.
 */
export function useSmoothedPoint(
  target: GeoPoint | undefined | null,
  { durationMs = DEFAULT_DURATION_MS, snapAboveMeters = DEFAULT_SNAP_ABOVE_M }: SmoothedPointOptions = {},
): GeoPoint | undefined {
  const [point, setPoint] = useState<GeoPoint | undefined>(target ?? undefined);
  // What is on screen right now, readable from inside the timer without
  // making the effect depend on it (which would restart the travel on every
  // committed frame).
  const shown = useRef<GeoPoint | undefined>(target ?? undefined);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (target === undefined || target === null) return;

    const from = shown.current;
    const jumped = from !== undefined && metresBetween(from, target) > snapAboveMeters;

    if (from === undefined || jumped || reducedMotion || durationMs <= 0) {
      shown.current = target;
      setPoint(target);
      return;
    }

    if (from.lat === target.lat && from.lng === target.lng) return;

    const origin = from;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const t = Math.min(elapsed / durationMs, 1);
      const next = {
        lat: origin.lat + (target.lat - origin.lat) * t,
        lng: origin.lng + (target.lng - origin.lng) * t,
      };
      shown.current = next;
      setPoint(next);
      if (t >= 1) clearInterval(timer);
    }, FRAME_MS);

    return () => {
      clearInterval(timer);
    };
    // `target.lat`/`target.lng` rather than `target`: the socket hands back a
    // fresh object on every tick, so depending on the object identity would
    // restart the travel even when the driver has not moved a centimetre.
  }, [target?.lat, target?.lng, durationMs, snapAboveMeters, reducedMotion]);

  return point;
}
