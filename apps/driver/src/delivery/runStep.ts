import type { OrderStatus } from "@kaya/core";

/** The action the driver can take right now on a run. */
export type RunAction = "start" | "pickup" | "transit" | "deliver" | "done";

export interface RunStep {
  /** What tapping the action bar does. `done` means there is nothing left. */
  action: RunAction;
  /** i18n key for the action bar's label. */
  labelKey: string;
  /** 0-3 position on the four-step timeline, for the progress rail. */
  index: 0 | 1 | 2 | 3;
}

/**
 * Where a run stands, from the order's status.
 *
 * The order's status, not the delivery's: `DeliveriesService.transition()`
 * moves the *order* through driver_en_route -> picked_up -> in_transit ->
 * delivered while the delivery itself sits in `in_progress` for the whole run
 * and only changes at the end. The delivery's own status answers "is this run
 * over", never "what happens next", and reading it here would leave the action
 * bar frozen on the first step for the entire delivery.
 *
 * Kept as a pure function, away from the screen, because it is the one piece
 * of judgement on that screen and every wrong answer strands a driver holding
 * a package: an action bar offering "confirm pickup" to someone already in
 * transit posts a transition the backend rejects, and the message they get
 * back is about state machines.
 */
export function runStepFor(status: OrderStatus | undefined): RunStep {
  switch (status) {
    // A freshly accepted order sits in `accepted`; `offers_received` is here
    // because a delivery exists at all only once an offer was accepted, and
    // an order whose status lagged behind should still let the run begin
    // rather than presenting a dead screen.
    case "accepted":
    case "offers_received":
    case "published":
      return { action: "start", labelKey: "trackEnRoute", index: 0 };
    case "driver_en_route":
      return { action: "pickup", labelKey: "driverTakePickupPhoto", index: 1 };
    case "picked_up":
      return { action: "transit", labelKey: "trackInTransit", index: 2 };
    case "in_transit":
      return { action: "deliver", labelKey: "trackDelivered", index: 3 };
    // delivered, cancelled, disputed, draft: nothing further to post. The
    // screen renders the timeline and no action rather than a button whose
    // only outcome is a 400.
    default:
      return { action: "done", labelKey: "trackDelivered", index: 3 };
  }
}
