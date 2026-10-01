import { messageSchema, queryKeys, type Message } from "@kaya/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { useMessages, useSendMessage } from "./messages";
import { useRateDelivery } from "./ratings";

const mockListMessages = jest.fn();
const mockSendMessage = jest.fn();
const mockRateDelivery = jest.fn();
const mockJoinDelivery = jest.fn();
const mockLeaveDelivery = jest.fn();

jest.mock("../api/client", () => ({
  api: {
    listMessages: (...args: unknown[]) => mockListMessages(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    rateDelivery: (...args: unknown[]) => mockRateDelivery(...args),
  },
}));

jest.mock("../realtime/socket", () => ({
  socketService: {
    joinDelivery: (...args: unknown[]) => mockJoinDelivery(...args),
    leaveDelivery: (...args: unknown[]) => mockLeaveDelivery(...args),
  },
}));

function message(overrides: Record<string, unknown> = {}): Message {
  return messageSchema.parse({
    id: "m-1",
    delivery_id: "d-1",
    sender_id: "u-1",
    receiver_id: "u-2",
    message_text: "En route",
    image_url: null,
    is_read: false,
    created_at: "2026-08-10T10:00:00.000Z",
    ...overrides,
  });
}

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
  mockListMessages.mockReset().mockResolvedValue([message()]);
  mockSendMessage.mockReset().mockResolvedValue(message({ id: "m-2", message_text: "Merci" }));
  mockRateDelivery.mockReset().mockResolvedValue({ id: "r-1" });
  mockJoinDelivery.mockReset();
  mockLeaveDelivery.mockReset();
});

describe("useMessages", () => {
  it("joins the delivery room, which is what unlocks chat:message", () => {
    setup(() => useMessages("d-1"));

    expect(mockJoinDelivery).toHaveBeenCalledWith("d-1");
  });

  it("stops dispatching for the delivery on unmount", () => {
    const { unmount } = setup(() => useMessages("d-1"));

    unmount();

    expect(mockLeaveDelivery).toHaveBeenCalledWith("d-1");
  });

  it("stores the thread under the key the realtime bridge appends to", async () => {
    const { result, queryClient } = setup(() => useMessages("d-1"));

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(queryClient.getQueryData(queryKeys.messages("d-1"))).toHaveLength(1);
  });
});

describe("useSendMessage", () => {
  it("sends over REST, not over the socket", async () => {
    // An emit is fire-and-forget: a message sent while the transport is
    // quietly down would vanish with the composer cleared and nothing shown.
    const { result } = setup(() => useSendMessage("d-1"));

    result.current.mutate("Merci");

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith("d-1", { messageText: "Merci" }));
  });

  it("trims what it sends", async () => {
    const { result } = setup(() => useSendMessage("d-1"));

    result.current.mutate("  Merci  ");

    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith("d-1", { messageText: "Merci" }),
    );
  });

  it("appends the returned message rather than refetching the thread", async () => {
    const { result, queryClient } = setup(() => useSendMessage("d-1"));
    queryClient.setQueryData(queryKeys.messages("d-1"), [message()]);

    result.current.mutate("Merci");

    await waitFor(() =>
      expect(queryClient.getQueryData<Message[]>(queryKeys.messages("d-1"))).toHaveLength(2),
    );
    expect(mockListMessages).not.toHaveBeenCalled();
  });

  it("does not duplicate a message the socket already delivered", async () => {
    // The gateway rebroadcasts to the whole room including the sender, so the
    // rebroadcast can land before this resolves.
    const { result, queryClient } = setup(() => useSendMessage("d-1"));
    queryClient.setQueryData(queryKeys.messages("d-1"), [message({ id: "m-2" })]);

    result.current.mutate("Merci");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<Message[]>(queryKeys.messages("d-1"))).toHaveLength(1);
  });
});

describe("useRateDelivery", () => {
  it("sends the score", async () => {
    const { result } = setup(() => useRateDelivery("d-1"));

    result.current.mutate({ score: 4, comment: "", toUserId: "u-2" });

    await waitFor(() =>
      expect(mockRateDelivery).toHaveBeenCalledWith("d-1", { score: 4, toUserId: "u-2" }),
    );
  });

  it("omits a blank comment rather than sending an empty string", async () => {
    const { result } = setup(() => useRateDelivery("d-1"));

    result.current.mutate({ score: 5, comment: "   ", toUserId: "u-2" });

    await waitFor(() => expect(mockRateDelivery).toHaveBeenCalled());
    expect(mockRateDelivery.mock.calls[0]?.[1]).not.toHaveProperty("comment");
  });

  it("never replays -- a rating is not idempotent and moves a driver's score", async () => {
    mockRateDelivery.mockRejectedValue(new Error("500"));
    const { result } = setup(() => useRateDelivery("d-1"));

    result.current.mutate({ score: 4, comment: "", toUserId: "u-2" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockRateDelivery).toHaveBeenCalledTimes(1);
  });
});
