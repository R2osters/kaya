import { queryKeys } from "@kaya/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { useCreateOrder, type NewOrderInput } from "./orders";

const mockCreateOrder = jest.fn();
const mockPublishOrder = jest.fn();

jest.mock("../api/client", () => ({
  api: {
    createOrder: (...args: unknown[]) => mockCreateOrder(...args),
    publishOrder: (...args: unknown[]) => mockPublishOrder(...args),
  },
}));

const OSU = {
  label: "Osu, Accra, Ghana",
  name: "Osu",
  city: "Accra",
  countryCode: "GH",
  lat: 5.5606,
  lng: -0.1824,
};
const TEMA = { ...OSU, label: "Tema Station, Tema, Ghana", name: "Tema Station", lat: 5.6698, lng: -0.0166 };

const DRAFT = { id: "order-1", status: "draft" };
const PUBLISHED = { id: "order-1", status: "published" };

function input(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  return { pickup: OSU, dropoff: TEMA, description: "", size: "M", ...overrides };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useCreateOrder(), { wrapper });
  return { result, queryClient };
}

beforeEach(() => {
  mockCreateOrder.mockReset().mockResolvedValue(DRAFT);
  mockPublishOrder.mockReset().mockResolvedValue(PUBLISHED);
});

describe("useCreateOrder", () => {
  it("sends both addresses with their coordinates", async () => {
    const { result } = setup();

    result.current.mutate(input());

    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupAddress: OSU.label,
        pickupLat: OSU.lat,
        pickupLng: OSU.lng,
        deliveryAddress: TEMA.label,
        deliveryLat: TEMA.lat,
        deliveryLng: TEMA.lng,
      }),
    );
  });

  it("publishes what it created, in that order", async () => {
    // An order created and not published sits in `draft`: invisible to every
    // driver, and to the client who created it, with nothing on screen to say so.
    const { result } = setup();

    result.current.mutate(input());

    await waitFor(() => expect(mockPublishOrder).toHaveBeenCalledWith(DRAFT.id));
    expect(mockCreateOrder.mock.invocationCallOrder[0]).toBeLessThan(
      mockPublishOrder.mock.invocationCallOrder[0] as number,
    );
  });

  it("resolves with the published order, not the draft", async () => {
    const { result } = setup();

    result.current.mutate(input());

    await waitFor(() => expect(result.current.data).toEqual(PUBLISHED));
  });

  it("sends the size as the backend's `dimensions`", async () => {
    const { result } = setup();

    result.current.mutate(input({ size: "L" }));

    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
    expect(mockCreateOrder.mock.calls[0]?.[0]).toMatchObject({ dimensions: "L" });
  });

  it("omits a blank description rather than sending an empty string", async () => {
    const { result } = setup();

    result.current.mutate(input({ description: "   " }));

    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
    expect(mockCreateOrder.mock.calls[0]?.[0]).not.toHaveProperty("description");
  });

  it("trims a description it does send", async () => {
    const { result } = setup();

    result.current.mutate(input({ description: "  shoe box  " }));

    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
    expect(mockCreateOrder.mock.calls[0]?.[0]).toMatchObject({ description: "shoe box" });
  });

  it("reports a failed publish instead of resolving", async () => {
    // The order exists by then. Swallowing this leaves a draft the user
    // believes is live and no driver will ever see.
    mockPublishOrder.mockRejectedValue(new Error("409"));
    const { result } = setup();

    result.current.mutate(input());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not publish when creation failed", async () => {
    mockCreateOrder.mockRejectedValue(new Error("400"));
    const { result } = setup();

    result.current.mutate(input());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockPublishOrder).not.toHaveBeenCalled();
  });

  it("seeds the order detail so the offers screen does not refetch it", async () => {
    const { result, queryClient } = setup();

    result.current.mutate(input());

    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.order(PUBLISHED.id))).toEqual(PUBLISHED),
    );
  });

  it("does not retry -- a retried create is a duplicate order", async () => {
    mockCreateOrder.mockRejectedValue(new Error("500"));
    const { result } = setup();

    result.current.mutate(input());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
  });
});
