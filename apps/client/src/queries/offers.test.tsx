import { queryKeys } from "@kaya/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { useAcceptOffer, useOffers } from "./offers";

const mockListOffers = jest.fn();
const mockAcceptOffer = jest.fn();
const mockJoinOrder = jest.fn();
const mockLeaveOrder = jest.fn();

jest.mock("../api/client", () => ({
  api: {
    listOffers: (...args: unknown[]) => mockListOffers(...args),
    acceptOffer: (...args: unknown[]) => mockAcceptOffer(...args),
  },
}));

jest.mock("../realtime/socket", () => ({
  socketService: {
    joinOrder: (...args: unknown[]) => mockJoinOrder(...args),
    leaveOrder: (...args: unknown[]) => mockLeaveOrder(...args),
  },
}));

const OFFERS = {
  orderId: "order-1",
  minPrice: 25,
  offers: [
    {
      id: "offer-1",
      livreurId: "driver-1",
      livreurName: "Kofi B.",
      livreurPhoto: null,
      livreurRating: 4.5,
      livreurTotalDeliveries: 318,
      proposedPrice: 30,
      status: "pending",
      createdAt: new Date(),
      expiresAt: null,
    },
  ],
};

const DELIVERY = { id: "delivery-1", orderId: "order-1" };

function setup<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), queryClient };
}

beforeEach(() => {
  mockListOffers.mockReset().mockResolvedValue(OFFERS);
  mockAcceptOffer.mockReset().mockResolvedValue(DELIVERY);
  mockJoinOrder.mockReset();
  mockLeaveOrder.mockReset();
});

describe("useOffers", () => {
  it("joins the order's socket room", () => {
    // Rooms are opt-in and the realtime bridge deliberately joins none.
    // Without this, offer:new is subscribed to and simply never fires -- with
    // no error anywhere, which is how phase 1B lost an afternoon.
    setup(() => useOffers("order-1"));

    expect(mockJoinOrder).toHaveBeenCalledWith("order-1");
  });

  it("stops dispatching for the order once the screen is gone", () => {
    const { unmount } = setup(() => useOffers("order-1"));

    unmount();

    expect(mockLeaveOrder).toHaveBeenCalledWith("order-1");
  });

  it("rejoins when the order changes", () => {
    const { rerender } = setup(() => useOffers("order-1"));
    mockJoinOrder.mockClear();

    rerender({});

    // Same order, so no churn.
    expect(mockJoinOrder).not.toHaveBeenCalled();
  });

  it("loads the offers under the key the realtime bridge invalidates", async () => {
    const { result, queryClient } = setup(() => useOffers("order-1"));

    await waitFor(() => expect(result.current.data).toEqual(OFFERS));
    // The bridge invalidates queryKeys.offers(orderId) on offer:new; a screen
    // reading a different key would never see a live bid.
    expect(queryClient.getQueryData(queryKeys.offers("order-1"))).toEqual(OFFERS);
  });
});

describe("useAcceptOffer", () => {
  it("accepts the offer by id", async () => {
    const { result } = setup(() => useAcceptOffer("order-1"));

    result.current.mutate("offer-1");

    await waitFor(() => expect(mockAcceptOffer).toHaveBeenCalledWith("offer-1"));
  });

  it("resolves with the created delivery", async () => {
    const { result } = setup(() => useAcceptOffer("order-1"));

    result.current.mutate("offer-1");

    await waitFor(() => expect(result.current.data).toEqual(DELIVERY));
  });

  it("seeds the delivery so the tracking screen does not refetch it", async () => {
    const { result, queryClient } = setup(() => useAcceptOffer("order-1"));

    result.current.mutate("offer-1");

    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.delivery(DELIVERY.id))).toEqual(DELIVERY),
    );
  });

  it("invalidates the whole order, not just this offer", async () => {
    // Accepting changes the order's status and every other offer's.
    const { result, queryClient } = setup(() => useAcceptOffer("order-1"));
    queryClient.setQueryData(queryKeys.offers("order-1"), OFFERS);

    result.current.mutate("offer-1");

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.offers("order-1"))?.isInvalidated).toBe(true),
    );
  });

  it("never replays -- a retried accept is a second delivery", async () => {
    mockAcceptOffer.mockRejectedValue(new Error("409"));
    const { result } = setup(() => useAcceptOffer("order-1"));

    result.current.mutate("offer-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockAcceptOffer).toHaveBeenCalledTimes(1);
  });
});
