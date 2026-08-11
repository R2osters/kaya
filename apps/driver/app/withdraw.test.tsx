import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import WithdrawScreen from "./withdraw";

const mockBack = jest.fn();
const mockWithdrawMutate = jest.fn();

let mockBalance: { data?: unknown } = { data: undefined };
let mockConfig: { data?: unknown; isPending: boolean } = { data: undefined, isPending: false };
let mockWithdraw: { isPending: boolean; isSuccess: boolean; error: unknown } = {
  isPending: false,
  isSuccess: false,
  error: null,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("../src/queries/driver", () => ({
  useDriverBalance: () => mockBalance,
}));

jest.mock("../src/queries/countryConfig", () => ({
  useCountryConfig: () => mockConfig,
}));

jest.mock("../src/queries/withdrawals", () => ({
  useRequestWithdrawal: () => ({ mutate: mockWithdrawMutate, ...mockWithdraw }),
}));

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <WithdrawScreen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBalance = { data: { balance: 250, currency: "GHS" } };
  mockConfig = {
    data: {
      currency: "GHS",
      withdrawalMethods: ["momo", "bank_transfer"],
      momoProviders: ["mtn", "vodafone"],
    },
    isPending: false,
  };
  mockWithdraw = { isPending: false, isSuccess: false, error: null };
});

describe("WithdrawScreen", () => {
  it("offers only the methods the driver's country actually has", () => {
    // Offering a Ghanaian bank transfer in Lomé produces a 400 nobody can act
    // on; the backend checks the same list.
    mockConfig = {
      data: { currency: "XOF", withdrawalMethods: ["momo"], momoProviders: ["moov"] },
      isPending: false,
    };
    renderScreen();

    expect(screen.queryByTestId("withdraw-method-bank_transfer")).toBeNull();
  });

  it("refuses to submit until an amount and account details are given", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("withdraw-submit"));

    expect(mockWithdrawMutate).not.toHaveBeenCalled();
  });

  it("refuses an amount above the available balance", () => {
    renderScreen();

    fireEvent.changeText(screen.getByTestId("withdraw-amount-input"), "400");
    fireEvent.changeText(screen.getByTestId("withdraw-phone-input"), "+233201111111");
    fireEvent.press(screen.getByTestId("withdraw-submit"));

    expect(mockWithdrawMutate).not.toHaveBeenCalled();
  });

  it("sends MoMo details in the shape the backend validates", () => {
    renderScreen();

    fireEvent.changeText(screen.getByTestId("withdraw-amount-input"), "100");
    fireEvent.changeText(screen.getByTestId("withdraw-phone-input"), "+233201111111");
    fireEvent.press(screen.getByTestId("withdraw-submit"));

    expect(mockWithdrawMutate).toHaveBeenCalledWith(
      {
        amount: 100,
        method: "momo",
        accountDetails: { phone: "+233201111111", provider: "mtn" },
      },
      expect.anything(),
    );
  });

  it("sends bank details as account_name/account_number, not as 'account'", () => {
    // The Dart original sent {'account': ...}, which fails the backend's
    // check every time. The port does not carry that over.
    renderScreen();

    fireEvent.press(screen.getByTestId("withdraw-method-bank_transfer"));
    fireEvent.changeText(screen.getByTestId("withdraw-amount-input"), "100");
    fireEvent.changeText(screen.getByTestId("withdraw-account-name-input"), "Kofi Boateng");
    fireEvent.changeText(screen.getByTestId("withdraw-account-number-input"), "0123456789");
    fireEvent.press(screen.getByTestId("withdraw-submit"));

    expect(mockWithdrawMutate.mock.calls[0]?.[0]).toMatchObject({
      method: "bank_transfer",
      accountDetails: { account_name: "Kofi Boateng", account_number: "0123456789" },
    });
  });

  it("rounds the amount to the currency's own unit", () => {
    // A request for 12.50 XOF is a request the CFA zone cannot pay, and this
    // is written straight into an append-only ledger.
    mockBalance = { data: { balance: 5000, currency: "XOF" } };
    mockConfig = {
      data: { currency: "XOF", withdrawalMethods: ["momo"], momoProviders: ["moov"] },
      isPending: false,
    };
    renderScreen();

    fireEvent.changeText(screen.getByTestId("withdraw-amount-input"), "1200.75");
    fireEvent.changeText(screen.getByTestId("withdraw-phone-input"), "+22890000000");
    fireEvent.press(screen.getByTestId("withdraw-submit"));

    expect(mockWithdrawMutate.mock.calls[0]?.[0]).toMatchObject({ amount: 1201 });
  });

  it("cannot be submitted twice -- a replay is a second debit", () => {
    mockWithdraw = { isPending: false, isSuccess: true, error: null };
    renderScreen();

    fireEvent.changeText(screen.getByTestId("withdraw-amount-input"), "100");
    fireEvent.changeText(screen.getByTestId("withdraw-phone-input"), "+233201111111");
    fireEvent.press(screen.getByTestId("withdraw-submit"));

    expect(mockWithdrawMutate).not.toHaveBeenCalled();
  });

  it("renders the one-per-day conflict as a message", () => {
    mockWithdraw = {
      isPending: false,
      isSuccess: false,
      error: new Error("Only one withdrawal request is allowed per day."),
    };
    renderScreen();

    expect(screen.getByTestId("withdraw-error")).toBeTruthy();
  });
});
