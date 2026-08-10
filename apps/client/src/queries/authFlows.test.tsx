import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { devPhoneVerification } from "../auth/phoneVerification";
import { useRegister, useResetPassword, useSendVerificationCode } from "./authFlows";

const mockRegister = jest.fn();
const mockPasswordReset = jest.fn();

jest.mock("../api/client", () => ({
  api: {
    register: (...args: unknown[]) => mockRegister(...args),
    passwordReset: (...args: unknown[]) => mockPasswordReset(...args),
  },
}));

function setup<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(hook, { wrapper });
}

beforeEach(() => {
  mockRegister.mockReset().mockResolvedValue({ user: { id: "u1" } });
  mockPasswordReset.mockReset().mockResolvedValue(undefined);
});

describe("devPhoneVerification", () => {
  it("returns a token the backend's mock verifier accepts", async () => {
    const handle = await devPhoneVerification.sendCode("+233201234567");

    await expect(devPhoneVerification.confirmCode(handle, "123456")).resolves.toBe(
      "kaya-mock-verifier:+233201234567",
    );
  });

  it("trims the phone, so the token's subject matches the account", async () => {
    const handle = await devPhoneVerification.sendCode("  +233201234567  ");

    await expect(devPhoneVerification.confirmCode(handle, "123456")).resolves.toBe(
      "kaya-mock-verifier:+233201234567",
    );
  });

  it("still requires a code, so a screen's own check cannot rot unnoticed", async () => {
    const handle = await devPhoneVerification.sendCode("+233201234567");

    await expect(devPhoneVerification.confirmCode(handle, "  ")).rejects.toThrow();
  });

  it("requires a phone", async () => {
    await expect(devPhoneVerification.sendCode("  ")).rejects.toThrow();
  });
});

describe("useSendVerificationCode", () => {
  it("returns the handle the confirmation step needs", async () => {
    const { result } = setup(useSendVerificationCode);

    result.current.mutate("+233201234567");

    await waitFor(() => expect(result.current.data).toBe("+233201234567"));
  });

  it("never replays -- a retry is a second SMS", async () => {
    const { result } = setup(useSendVerificationCode);

    result.current.mutate("");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.failureCount).toBe(1);
  });
});

describe("useResetPassword", () => {
  it("sends the phone, the proof and the new password together", async () => {
    const { result } = setup(useResetPassword);

    result.current.mutate({ phone: "+233201234567", code: "123456", newPassword: "NewPass1!" });

    await waitFor(() => expect(mockPasswordReset).toHaveBeenCalled());
    expect(mockPasswordReset).toHaveBeenCalledWith({
      phone: "+233201234567",
      firebaseIdToken: "kaya-mock-verifier:+233201234567",
      newPassword: "NewPass1!",
    });
  });

  it("does not call the backend when the code is rejected", async () => {
    // The proof is single-use: spending it and then failing to send it leaves
    // the user holding something they cannot use.
    const { result } = setup(useResetPassword);

    result.current.mutate({ phone: "+233201234567", code: "", newPassword: "NewPass1!" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockPasswordReset).not.toHaveBeenCalled();
  });
});

describe("useRegister", () => {
  const input = {
    fullName: "Ama Owusu",
    email: "AMA@Example.com",
    phone: " +233201234567 ",
    password: "Pass1234!",
    countryCode: "GHA",
    code: "123456",
  };

  it("registers with the verified phone", async () => {
    const { result } = setup(useRegister);

    result.current.mutate(input);

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+233201234567",
        firebaseIdToken: "kaya-mock-verifier:+233201234567",
        countryCode: "GHA",
      }),
    );
  });

  it("lowercases the email, which the backend matches on", async () => {
    const { result } = setup(useRegister);

    result.current.mutate(input);

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockRegister.mock.calls[0]?.[0]).toMatchObject({ email: "ama@example.com" });
  });

  it("signs up clients only -- a driver needs country-specific documents", async () => {
    const { result } = setup(useRegister);

    result.current.mutate(input);

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockRegister.mock.calls[0]?.[0]).toMatchObject({ role: "client" });
  });

  it("never replays -- a retried register is a 409 on an account just created", async () => {
    mockRegister.mockRejectedValue(new Error("500"));
    const { result } = setup(useRegister);

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });
});
