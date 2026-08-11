import type { NotificationType } from "@kaya/core";

/**
 * Where a tapped notification takes the driver.
 *
 * The mirror of the client's table, and deliberately a separate one: the same
 * `type` means a different screen on this side. A `delivery` push sends the
 * client to a map they watch and the driver to the run they are executing;
 * an `offer` push tells the client a bid arrived and tells the driver whether
 * theirs won.
 *
 * Pure, so the mapping can be checked without a device -- a wrong answer here
 * sends a driver who tapped "your offer was accepted" to a notification list,
 * at the moment they most need the run.
 *
 * Returns null when the payload names nothing openable; the caller falls back
 * to the notification list, which is always truthful.
 */
export function notificationRoute(
  type: NotificationType,
  data: Record<string, string>,
): string | null {
  const deliveryId = data["deliveryId"];
  const orderId = data["orderId"] ?? data["reminderFor"];

  switch (type) {
    // A delivery exists and it is theirs to run. Payment news about it
    // matters here too -- escrow being held is what unblocks /start.
    case "delivery":
    case "payment":
      return deliveryId === undefined ? null : `/delivery/${deliveryId}`;

    // Work published nearby, or news about a bid. Both land on the bid
    // screen: it shows the order and what it is worth, and refuses a second
    // bid on its own.
    case "offer":
    case "order":
      return orderId === undefined ? null : `/propose/${orderId}`;

    // A withdrawal moved. The earnings tab is where its status lives.
    case "withdrawal":
      return "/(tabs)/earnings";

    case "rating":
    case "system":
      return null;
  }
}
