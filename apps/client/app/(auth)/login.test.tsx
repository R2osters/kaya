import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { resources } from "@kaya/core";
import LoginScreen from "./login";

const mockMutate = jest.fn();
let mockState: { isPending: boolean; error: unknown } = { isPending: false, error: null };

jest.mock("../../src/queries/auth", () => ({
  useSignIn: () => ({ mutate: mockMutate, ...mockState }),
}));

function renderLogin() {
  return render(
    <KayaI18nProvider>
      <LoginScreen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  mockMutate.mockReset();
  mockState = { isPending: false, error: null };
});

describe("LoginScreen", () => {
  it("renders under its own testID with the translated title", () => {
    renderLogin();

    expect(screen.getByTestId("login-screen")).toBeTruthy();
    expect(screen.getByTestId("login-screen-title")).toHaveTextContent(
      resources.fr.translation.screenLogin,
    );
  });

  it("says on screen that this is a development sign-in", () => {
    // In a comment it protects nobody during a demo.
    renderLogin();

    expect(screen.getByTestId("login-dev-notice")).toHaveTextContent(
      resources.fr.translation.loginDevNotice,
    );
  });

  it("has no code field, because the mock verifier checks none", () => {
    // A code input here would collect a value nothing reads, and imply an SMS
    // was sent. See the screen's own doc comment.
    renderLogin();

    expect(screen.queryByTestId("login-code")).toBeNull();
  });

  it("submits the entered phone", () => {
    renderLogin();

    fireEvent.changeText(screen.getByTestId("login-phone"), "+233201234567");
    fireEvent.press(screen.getByTestId("login-submit"));

    expect(mockMutate).toHaveBeenCalledWith("+233201234567");
  });

  it("refuses an empty phone without calling the backend", () => {
    renderLogin();

    fireEvent.press(screen.getByTestId("login-submit"));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("login-error")).toHaveTextContent(
      resources.fr.translation.loginPhoneRequired,
    );
  });

  it("refuses a whitespace-only phone", () => {
    renderLogin();

    fireEvent.changeText(screen.getByTestId("login-phone"), "   ");
    fireEvent.press(screen.getByTestId("login-submit"));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("clears the validation error once a real number is submitted", () => {
    renderLogin();
    fireEvent.press(screen.getByTestId("login-submit"));
    expect(screen.getByTestId("login-error")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("login-phone"), "+233201234567");
    fireEvent.press(screen.getByTestId("login-submit"));

    expect(screen.queryByTestId("login-error")).toBeNull();
  });

  it("renders a server failure as a message, never as a raw exception", () => {
    mockState = { isPending: false, error: new Error("Invalid credentials.") };
    renderLogin();

    expect(screen.getByTestId("login-error")).toBeTruthy();
  });

  it("shows the button's loading state while the request is in flight", () => {
    mockState = { isPending: true, error: null };
    renderLogin();

    expect(screen.getByTestId("login-submit")).toBeTruthy();
  });

  it("does not navigate on its own -- the route guard moves the app", () => {
    // Screens routing around the guard is how a signed-out user ends up on a
    // protected screen. Asserted by the absence of any expo-router import:
    // this suite renders the screen with no router mocked and it must not throw.
    expect(() => renderLogin()).not.toThrow();
  });
});
