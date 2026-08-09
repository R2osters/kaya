import { render, waitFor } from "@testing-library/react-native";
import { usePushRegistration } from "./usePushRegistration";

let mockStatus: "unknown" | "authenticated" | "anonymous" = "authenticated";
let mockSkipAuth = false;

const mockRegisterPush = jest.fn();
const mockTeardown = jest.fn();

jest.mock("./registerPush", () => ({
  registerPush: (...args: unknown[]) => mockRegisterPush(...args),
}));

jest.mock("../state/authStore", () => ({
  useAuthStore: (selector: (state: { status: string }) => unknown) =>
    selector({ status: mockStatus }),
}));

jest.mock("../config/env", () => ({
  get env() {
    return { skipAuth: mockSkipAuth };
  },
}));

jest.mock("@kaya/ui", () => ({
  PushAdapter: class {},
}));

function Probe() {
  usePushRegistration();
  return null;
}

beforeEach(() => {
  mockStatus = "authenticated";
  mockSkipAuth = false;
  mockTeardown.mockClear();
  mockRegisterPush.mockReset();
  mockRegisterPush.mockResolvedValue(mockTeardown);
});

describe("usePushRegistration", () => {
  it("registers once the session is authenticated", async () => {
    render(<Probe />);

    await waitFor(() => expect(mockRegisterPush).toHaveBeenCalledTimes(1));
  });

  it("does not register while anonymous -- the token has nowhere to land", () => {
    mockStatus = "anonymous";

    render(<Probe />);

    expect(mockRegisterPush).not.toHaveBeenCalled();
  });

  it("does not register while the session is still unknown", () => {
    mockStatus = "unknown";

    render(<Probe />);

    expect(mockRegisterPush).not.toHaveBeenCalled();
  });

  it("does not register under skipAuth, which has no backend", () => {
    mockSkipAuth = true;

    render(<Probe />);

    expect(mockRegisterPush).not.toHaveBeenCalled();
  });

  it("tears the registration down on unmount", async () => {
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(mockRegisterPush).toHaveBeenCalled());

    unmount();

    expect(mockTeardown).toHaveBeenCalled();
  });

  it("tears down a registration that resolves after unmount", async () => {
    // Sign-out landing mid-registration: without this the rotation listener
    // outlives the session and keeps re-registering this device against a user
    // who has signed out.
    let resolveRegistration: (teardown: () => void) => void = () => undefined;
    mockRegisterPush.mockImplementation(
      () =>
        new Promise<() => void>((resolve) => {
          resolveRegistration = resolve;
        }),
    );

    const { unmount } = render(<Probe />);
    unmount();
    resolveRegistration(mockTeardown);
    await waitFor(() => expect(mockTeardown).toHaveBeenCalled());
  });
});
