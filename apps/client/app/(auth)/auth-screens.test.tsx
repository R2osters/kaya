import { resources } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import PasswordResetScreen from "./password-reset";
import RegisterScreen from "./register";
import WelcomeScreen from "./welcome";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSendMutate = jest.fn();
const mockResetMutate = jest.fn();
const mockRegisterMutate = jest.fn();

let mockSend = { isPending: false, isSuccess: false, error: null as unknown };
let mockReset = { isPending: false, isSuccess: false, error: null as unknown };
let mockRegister = { isPending: false, error: null as unknown };

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("../../src/queries/authFlows", () => ({
  useSendVerificationCode: () => ({ mutate: mockSendMutate, ...mockSend }),
  useResetPassword: () => ({ mutate: mockResetMutate, ...mockReset }),
  useRegister: () => ({ mutate: mockRegisterMutate, ...mockRegister }),
}));

function renderScreen(Screen: () => ReactElement | null) {
  return render(
    <KayaI18nProvider>
      <Screen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockSendMutate.mockReset();
  mockResetMutate.mockReset();
  mockRegisterMutate.mockReset();
  mockSend = { isPending: false, isSuccess: false, error: null };
  mockReset = { isPending: false, isSuccess: false, error: null };
  mockRegister = { isPending: false, error: null };
});

describe("WelcomeScreen", () => {
  it("offers exactly two doors", () => {
    // The only screen most people see before deciding whether to use the
    // product at all.
    renderScreen(WelcomeScreen);

    expect(screen.getByTestId("welcome-login")).toBeTruthy();
    expect(screen.getByTestId("welcome-register")).toBeTruthy();
  });

  it("routes to sign-in and sign-up", () => {
    renderScreen(WelcomeScreen);

    fireEvent.press(screen.getByTestId("welcome-login"));
    expect(mockPush).toHaveBeenCalledWith("/login");

    fireEvent.press(screen.getByTestId("welcome-register"));
    expect(mockPush).toHaveBeenCalledWith("/register");
  });
});

describe("PasswordResetScreen", () => {
  it("asks for the phone before anything else", () => {
    renderScreen(PasswordResetScreen);

    expect(screen.getByTestId("password-reset-send")).toBeTruthy();
    expect(screen.queryByTestId("password-reset-code")).toBeNull();
  });

  it("refuses to send a code for an empty phone", () => {
    renderScreen(PasswordResetScreen);

    fireEvent.press(screen.getByTestId("password-reset-send"));

    expect(mockSendMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("password-reset-error")).toBeTruthy();
  });

  it("sends a code for the entered phone", () => {
    renderScreen(PasswordResetScreen);

    fireEvent.changeText(screen.getByTestId("password-reset-phone-input"), "+233201234567");
    fireEvent.press(screen.getByTestId("password-reset-send"));

    expect(mockSendMutate).toHaveBeenCalledWith("+233201234567");
  });

  it("locks the phone once a code is out", () => {
    // Changing it here would leave the code proving one number while the
    // request carried another, and the backend would reject it with nothing
    // on screen to explain why.
    mockSend = { isPending: false, isSuccess: true, error: null };
    renderScreen(PasswordResetScreen);

    expect(screen.getByTestId("password-reset-phone-input").props.editable).toBe(false);
    expect(screen.getByTestId("password-reset-code")).toBeTruthy();
  });

  it("refuses to reset without a code and a password", () => {
    mockSend = { isPending: false, isSuccess: true, error: null };
    renderScreen(PasswordResetScreen);

    fireEvent.press(screen.getByTestId("password-reset-submit"));

    expect(mockResetMutate).not.toHaveBeenCalled();
  });

  it("sends the phone entered before the code, together with the new password", () => {
    // The phone has to be typed while it is still editable -- it locks the
    // moment a code is out, which is the point of the test above. Typing it
    // after the lock is exactly what this screen refuses to let a user do.
    const { rerender } = renderScreen(PasswordResetScreen);
    fireEvent.changeText(screen.getByTestId("password-reset-phone-input"), "+233201234567");

    mockSend = { isPending: false, isSuccess: true, error: null };
    rerender(
      <KayaI18nProvider>
        <PasswordResetScreen />
      </KayaI18nProvider>,
    );

    fireEvent.changeText(screen.getByTestId("password-reset-code-input"), "123456");
    fireEvent.changeText(screen.getByTestId("password-reset-password-input"), "NewPass1!");
    fireEvent.press(screen.getByTestId("password-reset-submit"));

    expect(mockResetMutate).toHaveBeenCalledWith({
      phone: "+233201234567",
      code: "123456",
      newPassword: "NewPass1!",
    });
  });

  it("confirms and offers sign-in once it succeeded", () => {
    mockReset = { isPending: false, isSuccess: true, error: null };
    renderScreen(PasswordResetScreen);

    expect(screen.getByTestId("password-reset-success")).toHaveTextContent(
      resources.fr.translation.authResetPasswordSuccess,
    );
    fireEvent.press(screen.getByTestId("password-reset-to-login"));
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});

describe("RegisterScreen", () => {
  function fillContact() {
    fireEvent.changeText(screen.getByTestId("register-phone-input"), "+233201234567");
    fireEvent.press(screen.getByTestId("register-next"));
  }

  function fillIdentity() {
    fireEvent.changeText(screen.getByTestId("register-full-name-input"), "Ama Owusu");
    fireEvent.changeText(screen.getByTestId("register-email-input"), "ama@example.com");
    fireEvent.press(screen.getByTestId("register-next"));
  }

  it("starts on the contact step", () => {
    renderScreen(RegisterScreen);

    expect(screen.getByTestId("register-step-label")).toHaveTextContent(
      resources.fr.translation.authStepContact,
    );
    expect(screen.getByTestId("register-step-0-done")).toBeTruthy();
    expect(screen.queryByTestId("register-step-1-done")).toBeNull();
  });

  it("will not advance past an incomplete step", () => {
    renderScreen(RegisterScreen);

    fireEvent.press(screen.getByTestId("register-next"));

    expect(screen.getByTestId("register-error")).toBeTruthy();
    expect(screen.getByTestId("register-step-label")).toHaveTextContent(
      resources.fr.translation.authStepContact,
    );
  });

  it("offers all three launch countries, defaulting to Ghana", () => {
    // The country selects country_configs, which decides the currency someone
    // is billed in -- guessing it from a dialling code would be a guess about
    // money.
    renderScreen(RegisterScreen);

    for (const code of ["GHA", "TGO", "BEN"]) {
      expect(screen.getByTestId(`register-country-${code}`)).toBeTruthy();
    }
  });

  it("walks contact, identity, then security", () => {
    renderScreen(RegisterScreen);

    fillContact();
    expect(screen.getByTestId("register-step-label")).toHaveTextContent(
      resources.fr.translation.authStepIdentity,
    );

    fillIdentity();
    expect(screen.getByTestId("register-step-label")).toHaveTextContent(
      resources.fr.translation.authStepSecurity,
    );
  });

  it("can go back without losing what was typed", () => {
    renderScreen(RegisterScreen);
    fillContact();

    fireEvent.press(screen.getByTestId("register-back"));

    expect(screen.getByTestId("register-phone-input").props.value).toBe("+233201234567");
  });

  it("has no back button on the first step", () => {
    renderScreen(RegisterScreen);

    expect(screen.queryByTestId("register-back")).toBeNull();
  });

  it("registers with everything collected, and the chosen country", () => {
    renderScreen(RegisterScreen);
    fireEvent.press(screen.getByTestId("register-country-TGO"));
    fillContact();
    fillIdentity();

    fireEvent.changeText(screen.getByTestId("register-password-input"), "Pass1234!");
    fireEvent.changeText(screen.getByTestId("register-code-input"), "123456");
    fireEvent.press(screen.getByTestId("register-next"));

    expect(mockRegisterMutate).toHaveBeenCalledWith(
      {
        fullName: "Ama Owusu",
        email: "ama@example.com",
        phone: "+233201234567",
        password: "Pass1234!",
        countryCode: "TGO",
        code: "123456",
      },
      expect.anything(),
    );
  });

  it("routes to sign-in only once the account exists", () => {
    renderScreen(RegisterScreen);
    fillContact();
    fillIdentity();
    fireEvent.changeText(screen.getByTestId("register-password-input"), "Pass1234!");
    fireEvent.changeText(screen.getByTestId("register-code-input"), "123456");
    fireEvent.press(screen.getByTestId("register-next"));

    expect(mockReplace).not.toHaveBeenCalled();

    const options = mockRegisterMutate.mock.calls[0]?.[1] as { onSuccess: () => void };
    options.onSuccess();

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("renders a server failure as a message", () => {
    mockRegister = { isPending: false, error: new Error("Email already in use.") };
    renderScreen(RegisterScreen);

    expect(screen.getByTestId("register-error")).toBeTruthy();
  });
});
