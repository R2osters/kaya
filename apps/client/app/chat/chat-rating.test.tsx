import { messageSchema } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import ChatScreen from "./[deliveryId]";
import RatingScreen from "../rating/[deliveryId]";

const mockReplace = jest.fn();
const mockSendMutate = jest.fn();
const mockRateMutate = jest.fn();
let mockMessages: { data?: unknown; isPending: boolean } = { data: [], isPending: false };
let mockSend = { isPending: false, error: null as unknown };
let mockRate = { isPending: false, error: null as unknown };
let mockUserId: string | undefined = "u-1";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ deliveryId: "d-1" }),
}));

jest.mock("../../src/queries/messages", () => ({
  useMessages: () => mockMessages,
  useSendMessage: () => ({ mutate: mockSendMutate, ...mockSend }),
}));

jest.mock("../../src/queries/ratings", () => ({
  useRateDelivery: () => ({ mutate: mockRateMutate, ...mockRate }),
}));

// The rating screen reads the delivery to learn who it is rating (the
// driver); the backend cross-checks toUserId against the participants.
let mockDelivery: { data?: { livreurId?: string } } = { data: { livreurId: "u-2" } };
jest.mock("../../src/queries/deliveries", () => ({
  useDelivery: () => mockDelivery,
}));

jest.mock("../../src/state/authStore", () => ({
  useAuthStore: (selector: (state: { user: { id?: string } | null }) => unknown) =>
    selector({ user: mockUserId === undefined ? null : { id: mockUserId } }),
}));

function message(overrides: Record<string, unknown> = {}) {
  return messageSchema.parse({
    id: "m-1",
    delivery_id: "d-1",
    sender_id: "u-1",
    receiver_id: "u-2",
    message_text: "En route",
    is_read: false,
    created_at: "2026-08-10T10:00:00.000Z",
    ...overrides,
  });
}

function renderScreen(Screen: () => React.ReactElement | null) {
  return render(
    <KayaI18nProvider>
      <Screen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  mockReplace.mockReset();
  mockSendMutate.mockReset();
  mockRateMutate.mockReset();
  mockMessages = { data: [], isPending: false };
  mockSend = { isPending: false, error: null };
  mockRate = { isPending: false, error: null };
  mockDelivery = { data: { livreurId: "u-2" } };
  mockUserId = "u-1";
});

describe("ChatScreen", () => {
  it("shows an empty state on a thread with nothing in it", () => {
    renderScreen(ChatScreen);

    expect(screen.getByTestId("chat-empty")).toBeTruthy();
  });

  it("puts the signed-in user's messages on their own side", () => {
    // The backend has no notion of "mine"; a client and a driver read the same
    // thread from opposite ends.
    mockMessages = {
      data: [message({ id: "mine", sender_id: "u-1" }), message({ id: "theirs", sender_id: "u-2" })],
      isPending: false,
    };
    renderScreen(ChatScreen);

    expect(screen.getByTestId("chat-message-0-mine")).toBeTruthy();
    expect(screen.getByTestId("chat-message-1")).toBeTruthy();
    expect(screen.queryByTestId("chat-message-1-mine")).toBeNull();
  });

  it("sends what was typed", () => {
    renderScreen(ChatScreen);

    fireEvent.changeText(screen.getByTestId("chat-input-input"), "Merci");
    fireEvent.press(screen.getByTestId("chat-send"));

    expect(mockSendMutate).toHaveBeenCalledWith("Merci");
  });

  it("sends nothing for an empty or whitespace draft", () => {
    renderScreen(ChatScreen);

    fireEvent.press(screen.getByTestId("chat-send"));
    fireEvent.changeText(screen.getByTestId("chat-input-input"), "   ");
    fireEvent.press(screen.getByTestId("chat-send"));

    expect(mockSendMutate).not.toHaveBeenCalled();
  });

  it("clears the composer, which is the feedback that it left", () => {
    renderScreen(ChatScreen);

    fireEvent.changeText(screen.getByTestId("chat-input-input"), "Merci");
    fireEvent.press(screen.getByTestId("chat-send"));

    expect(screen.getByTestId("chat-input-input").props.value).toBe("");
  });

  it("renders a send failure as a message", () => {
    mockSend = { isPending: false, error: new Error("offline") };
    renderScreen(ChatScreen);

    expect(screen.getByTestId("chat-error")).toBeTruthy();
  });
});

describe("RatingScreen", () => {
  it("starts with no score chosen", () => {
    // A pre-filled five stars is a rating the platform wrote, on a marketplace
    // where a driver's score decides how much work they get.
    renderScreen(RatingScreen);

    expect(screen.getByTestId("rating-submit")).toBeTruthy();
    fireEvent.press(screen.getByTestId("rating-submit"));
    expect(mockRateMutate).not.toHaveBeenCalled();
  });

  it("submits the chosen score", () => {
    renderScreen(RatingScreen);

    // Star testIDs are zero-indexed, so star-3 is the fourth star.
    fireEvent.press(screen.getByTestId("rating-stars-star-3"));
    fireEvent.press(screen.getByTestId("rating-submit"));

    expect(mockRateMutate).toHaveBeenCalledWith(
      { score: 4, comment: "", toUserId: "u-2" },
      expect.anything(),
    );
  });

  it("submits nothing while the delivery (and so the ratee) is unknown", () => {
    // Without the delivery there is no toUserId, and a request without one is
    // the 400 the first live rating hit.
    mockDelivery = { data: undefined };
    renderScreen(RatingScreen);

    fireEvent.press(screen.getByTestId("rating-stars-star-3"));
    fireEvent.press(screen.getByTestId("rating-submit"));

    expect(mockRateMutate).not.toHaveBeenCalled();
  });

  it("carries an optional comment", () => {
    renderScreen(RatingScreen);

    fireEvent.press(screen.getByTestId("rating-stars-star-4"));
    fireEvent.changeText(screen.getByTestId("rating-comment-input"), "Rapide et poli");
    fireEvent.press(screen.getByTestId("rating-submit"));

    expect(mockRateMutate.mock.calls[0]?.[0]).toMatchObject({ comment: "Rapide et poli" });
  });

  it("leaves the screen only once the rating is recorded", () => {
    renderScreen(RatingScreen);
    fireEvent.press(screen.getByTestId("rating-stars-star-3"));
    fireEvent.press(screen.getByTestId("rating-submit"));

    expect(mockReplace).not.toHaveBeenCalled();

    const options = mockRateMutate.mock.calls[0]?.[1] as { onSuccess: () => void };
    options.onSuccess();

    expect(mockReplace).toHaveBeenCalledWith("/home");
  });

  it("renders a failure as a message", () => {
    mockRate = { isPending: false, error: new Error("409") };
    renderScreen(RatingScreen);

    expect(screen.getByTestId("rating-error")).toBeTruthy();
  });
});
