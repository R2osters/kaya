import { queryKeys } from "@kaya/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { devTokenFor, useSignIn } from "./auth";

const mockLoginOtp = jest.fn();
const mockSignIn = jest.fn();

jest.mock("../api/client", () => ({
  api: { loginOtp: (...args: unknown[]) => mockLoginOtp(...args) },
}));

jest.mock("../state/authStore", () => ({
  useAuthStore: (selector: (state: { signIn: unknown }) => unknown) =>
    selector({ signIn: (...args: unknown[]) => mockSignIn(...args) }),
}));

const RESULT = {
  tokens: { accessToken: "access", refreshToken: "refresh" },
  user: { id: "u1", fullName: "Ama Owusu" },
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSignIn(), { wrapper });
  return { result, queryClient };
}

beforeEach(() => {
  mockLoginOtp.mockReset().mockResolvedValue(RESULT);
  mockSignIn.mockReset().mockResolvedValue(undefined);
});

describe("devTokenFor", () => {
  it("is long enough for the MinLength(20) every auth DTO puts on the token", () => {
    // A shorter prefix was rejected by the endpoint before the verifier saw
    // it, which only a run against the real backend revealed.
    expect(devTokenFor("+233201234567").length).toBeGreaterThanOrEqual(20);
  });

  it("builds the prefixed token the mock verifier accepts", () => {
    expect(devTokenFor("+233201234567")).toBe("kaya-mock-verifier:+233201234567");
  });

  it("trims, so a pasted number with whitespace still matches the account", () => {
    // The backend compares the token's subject to the phone on the account;
    // an untrimmed subject silently fails to match and reads as bad credentials.
    expect(devTokenFor("  +233201234567 ")).toBe("kaya-mock-verifier:+233201234567");
  });
});

describe("useSignIn", () => {
  it("sends the phone and its dev token", async () => {
    const { result } = setup();

    result.current.mutate("+233201234567");

    await waitFor(() => expect(mockLoginOtp).toHaveBeenCalled());
    expect(mockLoginOtp).toHaveBeenCalledWith({
      phone: "+233201234567",
      firebaseIdToken: "kaya-mock-verifier:+233201234567",
    });
  });

  it("trims the phone in the request as well as in the token", async () => {
    const { result } = setup();

    result.current.mutate("  +233201234567  ");

    await waitFor(() => expect(mockLoginOtp).toHaveBeenCalled());
    expect(mockLoginOtp).toHaveBeenCalledWith({
      phone: "+233201234567",
      firebaseIdToken: "kaya-mock-verifier:+233201234567",
    });
  });

  it("hands the result to the auth store, which owns the keychain write", async () => {
    const { result } = setup();

    result.current.mutate("+233201234567");

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith(RESULT));
  });

  it("clears cached data from any previous session", async () => {
    // Without this the route guard would show the new user whatever the last
    // one left in the cache until each query refetched.
    const { result, queryClient } = setup();
    queryClient.setQueryData(queryKeys.orderList(), ["someone else's order"]);

    result.current.mutate("+233201234567");

    await waitFor(() => expect(queryClient.getQueryData(queryKeys.orderList())).toBeUndefined());
  });

  it("seeds the signed-in user, so the first screen does not refetch /auth/me", async () => {
    const { result, queryClient } = setup();

    result.current.mutate("+233201234567");

    await waitFor(() => expect(queryClient.getQueryData(queryKeys.me())).toEqual(RESULT.user));
  });

  it("does not touch the session when the request fails", async () => {
    mockLoginOtp.mockRejectedValue(new Error("401"));
    const { result } = setup();

    result.current.mutate("+233201234567");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("does not retry a failed sign-in", async () => {
    // Money-path default from queryClient.ts: mutations never replay. Sign-in
    // is not a money path, but the rule is the default rather than an opt-in,
    // and repeated attempts here feed the backend's brute-force lockout.
    mockLoginOtp.mockRejectedValue(new Error("401"));
    const { result } = setup();

    result.current.mutate("+233201234567");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockLoginOtp).toHaveBeenCalledTimes(1);
  });
});
