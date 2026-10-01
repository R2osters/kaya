import type { NotificationType } from "@kaya/core";
import type { Href } from "expo-router";

/**
 * Where a tapped notification takes the client.
 *
 * The backend sends `type` plus the ids the event is about, in the FCM data
 * payload (see NotificationsService.notify). This turns that pair into a
 * route, and it is a pure function so the mapping can be checked without a
 * device -- a wrong answer here sends someone who tapped "your driver has
 * arrived" to a list of notifications, which is the moment a push stops being
 * worth sending.
 *
 * Returns null when the payload does not name anything openable. The caller
 * falls back to the notification list, which is always a truthful destination:
 * whatever it was, it is in there.
 */
// `Href` rather than a bare string: these routes are then checked against the
// app's real route tree, so a screen renamed out from under this mapping is a
// compile error here rather than a push that opens the wrong thing.
export function notificationRoute(
  type: NotificationType,
  data: Record<string, string>,
): Href | null {
  const deliveryId = data["deliveryId"];
  const orderId = data["orderId"] ?? data["reminderFor"];

  switch (type) {
    // A delivery exists, so the live map is the answer -- for the run itself
    // and for anything about its money, which the tracking screen also shows.
    case "delivery":
    case "payment":
      return deliveryId === undefined ? null : `/tracking/${deliveryId}`;

    // An offer arrived, or the order moved. Both land on the order's offers:
    // that is where a client acts, by accepting one.
    case "offer":
    case "order":
      return orderId === undefined ? null : `/offers/${orderId}`;

    // Nothing to open: a rating request has no screen of its own on this side
    // (the tracking screen offers it), and withdrawals are a driver concern.
    case "rating":
    case "withdrawal":
    case "system":
      return null;
  }
}
