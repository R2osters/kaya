import { resources } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import PaymentScreen from "./index";

const mockReplace = jest.fn();
const mockInitMutate = jest.fn();
const mockVerifyMutate = jest.fn();
const mockOpenGateway = jest.fn();
let mockParams: Record<string, string> = { deliveryId: "delivery-1", amount: "12.5", currency: "GHS" };
let mockInit: { isPending: boolean; error: unknown } = { isPending: false, error: null };
let mockVerify: { isPending: boolean; error: unknown } = { isPending: false, error: null };

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../../src/payments/openGateway", () => ({
  openPaymentGateway: (...args: unknown[]) => mockOpenGateway(...args),
}));

jest.mock("../../src/queries/payments", () => ({
  ...jest.requireActual("../../src/queries/payments"),
  useInitializePayment: () => ({ mutate: mockInitMutate, ...mockInit }),
  useVerifyPayment: () => ({ mutate: mockVerifyMutate, ...mockVerify }),
}));

const INIT = { reference: "ref-1", authorizationUrl: "https://checkout.example/ref-1" };

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <PaymentScreen />
    </KayaI18nProvider>,
  );
}

/** Runs the screen's pay flow with a chosen gateway return and verify status. */
async function pay({
  gateway = "returned",
  status = "success",
}: { gateway?: string; status?: string } = {}) {
  mockOpenGateway.mockResolvedValue(gateway);
  renderScreen();

  fireEvent.press(screen.getByTestId("payment-pay"));

  const initOptions = mockInitMutate.mock.calls[0]?.[1] as {
    onSuccess: (i: typeof INIT) => Promise<void>;
  };
  await act(async () => {
    await initOptions.onSuccess(INIT);
  });

  if (gateway === "returned") {
    const verifyOptions = mockVerifyMutate.mock.calls[0]?.[1] as {
      onSuccess: (v: { status: string }) => void;
    };
    act(() => {
      verifyOptions.onSuccess({ status });
    });
  }
}

beforeEach(() => {
  mockReplace.mockReset();
  mockInitMutate.mockReset();
  mockVerifyMutate.mockReset();
  mockOpenGateway.mockReset();
  mockParams = { deliveryId: "delivery-1", amount: "12.5", currency: "GHS" };
  mockInit = { isPending: false, error: null };
  mockVerify = { isPending: false, error: null };
});

describe("PaymentScreen", () => {
  it("shows the amount in its currency", () => {
    renderScreen();

    expect(screen.getByTestId("payment-amount")).toHaveTextContent("12.50 GHS");
  });

  it("shows a XOF amount in whole francs", () => {
    mockParams = { deliveryId: "delivery-1", amount: "941", currency: "XOF" };
    renderScreen();

    expect(screen.getByTestId("payment-amount")).toHaveTextContent(/941 XOF/);
  });

  it("says the payment happens outside the app", () => {
    // The user is about to type a PIN or a card number; where that happens is
    // something they should be told.
    renderScreen();

    expect(screen.getByTestId("payment-gateway-note")).toHaveTextContent(
      resources.fr.translation.payGatewayNote,
    );
  });

  it("has no method chooser -- the gateway's page offers the methods", () => {
    // InitializePaymentDto takes a delivery id and nothing else; tiles here
    // would change no request.
    renderScreen();

    expect(screen.queryByTestId("payment-method-momo")).toBeNull();
    expect(screen.queryByTestId("payment-method-card")).toBeNull();
  });

  it("initializes for the delivery, then opens the gateway's own URL", async () => {
    await pay();

    expect(mockInitMutate).toHaveBeenCalledWith("delivery-1", expect.anything());
    expect(mockOpenGateway).toHaveBeenCalledWith(INIT.authorizationUrl);
  });

  it("verifies with the backend rather than trusting the return", async () => {
    // Coming back through the redirect proves the user finished the gateway's
    // flow, not that money moved. The webhook is the authority.
    await pay();

    expect(mockVerifyMutate).toHaveBeenCalledWith(INIT.reference, expect.anything());
  });

  it("routes to the receipt only once the backend says paid", async () => {
    await pay({ status: "success" });

    expect(mockReplace).toHaveBeenCalledWith("/payment/receipt?deliveryId=delivery-1");
  });

  it("stays put and says so when the payment is still confirming", async () => {
    // Slow mobile-money confirmations are normal, not failures.
    await pay({ status: "pending" });

    await waitFor(() => expect(screen.getByTestId("payment-pending")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not route on a failed payment", async () => {
    await pay({ status: "failed" });

    await waitFor(() => expect(screen.getByTestId("payment-failed")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("treats an unknown gateway status as pending, never as paid", async () => {
    await pay({ status: "some_new_status" });

    await waitFor(() => expect(screen.getByTestId("payment-pending")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not verify when the user dismissed the gateway", async () => {
    await pay({ gateway: "dismissed" });

    expect(mockVerifyMutate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("payment-cancelled")).toBeTruthy());
  });

  it("lets the user try again after dismissing", async () => {
    await pay({ gateway: "dismissed" });

    fireEvent.press(screen.getByTestId("payment-pay"));

    expect(mockInitMutate).toHaveBeenCalledTimes(2);
  });

  it("renders a failure as a message", () => {
    mockInit = { isPending: false, error: new Error("Gateway unavailable.") };
    renderScreen();

    expect(screen.getByTestId("payment-error")).toBeTruthy();
  });
});
