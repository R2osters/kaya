import { queryKeys, type Order, type Paginated } from "@kaya/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "../api/client";

/**
 * The signed-in client's own orders (`GET /orders`).
 *
 * The response is paginated -- `{ data, page, limit, total }`, not a bare
 * array, which is a correction @kaya/core already carries -- so callers read
 * `.data`. Pagination itself is not wired: the history screen shows the first
 * page, and a client with more than a page of orders is a problem worth having
 * before it is worth solving.
 */
export function useMyOrders(): UseQueryResult<Paginated<Order>> {
  return useQuery({
    queryKey: queryKeys.orderList(),
    queryFn: () => api.listOrders(),
  });
}

/**
 * Splits an order list the way the history screen shows it: scheduled orders
 * that have not happened yet, and everything else.
 *
 * Exported and pure because the split is the only judgement on that screen,
 * and `isScheduled` alone is not it -- a scheduled order that has been
 * delivered belongs in the past, not in a list of things still to come.
 */
export function splitHistory(orders: Order[]): { upcoming: Order[]; past: Order[] } {
  const upcoming: Order[] = [];
  const past: Order[] = [];

  for (const order of orders) {
    const stillToCome =
      order.scheduledTime !== null && order.status !== "delivered" && order.status !== "cancelled";
    if (stillToCome) upcoming.push(order);
    else past.push(order);
  }

  // Most recent first in both lists: a history read top-down should start with
  // what just happened, and a schedule with what happens next.
  upcoming.sort((a, b) => (a.scheduledTime?.getTime() ?? 0) - (b.scheduledTime?.getTime() ?? 0));
  past.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { upcoming, past };
}
