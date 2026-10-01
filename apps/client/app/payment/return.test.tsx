import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import PaymentReturnScreen from "./return";

const mockVerifyPayment = jest.fn();
jest.mock("../../src/api/client", () => ({
  api: {
    verifyPayment: (...args: unknown[]) => mockVerifyPayment(...args),
  },
}));

const mockReplace = jest.fn();
let mockParams: Record<string, string | undefined> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PaymentReturnScreen />, { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { reference: "ref-1", deliveryId: "d1" };
});

describe("PaymentReturnScreen", () => {
  it("verifies the reference it arrived with and lands on the receipt when paid", async () => {
    mockVerifyPayment.mockResolvedValue({ reference: "ref-1", status: "success" });
    renderScreen();

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/payment/receipt?deliveryId=d1"),
    );
    expect(mockVerifyPayment).toHaveBeenCalledWith({ reference: "ref-1" });
  });

  it("shows pending as a state, not an error, and offers the way back", async () => {
    mockVerifyPayment.mockResolvedValue({ reference: "ref-1", status: "pending" });
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("payment-return-pending")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId("payment-return-back")).toBeTruthy();
  });

  it("shows the retry path when the gateway reports failure", async () => {
    mockVerifyPayment.mockResolvedValue({ reference: "ref-1", status: "failed" });
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("payment-return-failed")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("handles arriving with no reference without firing a verify", () => {
    mockParams = {};
    renderScreen();

    expect(mockVerifyPayment).not.toHaveBeenCalled();
    expect(screen.getByTestId("payment-return-failed")).toBeTruthy();
    expect(screen.getByTestId("payment-return-back")).toBeTruthy();
  });
});
