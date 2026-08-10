import { queryKeys } from "@kaya/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { paymentOutcome, useInitializePayment, useVerifyPayment } from "./payments";

const mockInitializePayment = jest.fn();
const mockVerifyPayment = jest.fn();

jest.mock("../api/client", () => ({
  api: {
    initializePayment: (...args: unknown[]) => mockInitializePayment(...args),
    verifyPayment: (...args: unknown[]) => mockVerifyPayment(...args),
  },
}));

const INIT = {
  transactionId: "tx-1",
  reference: "ref-1",
  authorizationUrl: "https://checkout.example/ref-1",
  amount: 12.5,
  currency: "GHS",
  gateway: "paystack",
};

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
  mockInitializePayment.mockReset().mockResolvedValue(INIT);
  mockVerifyPayment.mockReset().mockResolvedValue({ reference: "ref-1", status: "success" });
});

describe("useInitializePayment", () => {
  it("initializes for the delivery and returns the gateway URL", async () => {
    const { result } = setup(useInitializePayment);

    result.current.mutate("delivery-1");

    await waitFor(() => expect(result.current.data).toEqual(INIT));
    expect(mockInitializePayment).toHaveBeenCalledWith({ deliveryId: "delivery-1" });
  });

  it("never replays -- a second initialize is a second escrow hold", async () => {
    mockInitializePayment.mockRejectedValue(new Error("500"));
    const { result } = setup(useInitializePayment);

    result.current.mutate("delivery-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockInitializePayment).toHaveBeenCalledTimes(1);
  });
});

describe("useVerifyPayment", () => {
  it("verifies by reference", async () => {
    const { result } = setup(() => useVerifyPayment("delivery-1"));

    result.current.mutate("ref-1");

    await waitFor(() => expect(mockVerifyPayment).toHaveBeenCalledWith({ reference: "ref-1" }));
  });

  it("invalidates the delivery, whose payment status just changed", async () => {
    const { result, queryClient } = setup(() => useVerifyPayment("delivery-1"));
    queryClient.setQueryData(queryKeys.delivery("delivery-1"), { id: "delivery-1" });

    result.current.mutate("ref-1");

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.delivery("delivery-1"))?.isInvalidated).toBe(true),
    );
  });

  it("can be called again -- it reads gateway state rather than moving money", async () => {
    // The webhook may land before the user returns from the WebView, after it,
    // or minutes later on a slow mobile-money confirmation, so a screen has to
    // be able to ask more than once.
    const { result } = setup(() => useVerifyPayment("delivery-1"));

    result.current.mutate("ref-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    result.current.mutate("ref-1");

    await waitFor(() => expect(mockVerifyPayment).toHaveBeenCalledTimes(2));
  });
});

describe("paymentOutcome", () => {
  it("maps the gateway's success vocabulary", () => {
    expect(paymentOutcome("success")).toBe("paid");
    expect(paymentOutcome("paid")).toBe("paid");
    expect(paymentOutcome("completed")).toBe("paid");
  });

  it("maps the failure vocabulary, including Paystack's `abandoned`", () => {
    expect(paymentOutcome("failed")).toBe("failed");
    expect(paymentOutcome("abandoned")).toBe("failed");
    expect(paymentOutcome("cancelled")).toBe("failed");
  });

  it("is case-insensitive, since the vocabulary is the gateway's not ours", () => {
    expect(paymentOutcome("SUCCESS")).toBe("paid");
    expect(paymentOutcome("Failed")).toBe("failed");
  });

  it("treats anything unrecognised as pending, never as failed", () => {
    // Telling a user their payment failed when the status is merely unfamiliar
    // sends them to pay a second time.
    expect(paymentOutcome("some_new_gateway_status")).toBe("pending");
    expect(paymentOutcome("")).toBe("pending");
    expect(paymentOutcome("pending")).toBe("pending");
  });
});
