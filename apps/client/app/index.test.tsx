import { render } from "@testing-library/react-native";
import IndexRoute from "./index";

// expo-router's real <Redirect> needs a mounted navigator to act on; this
// unit only needs to prove IndexRoute asks for "/splash", not that
// navigation actually happens -- that end-to-end behaviour is covered by
// AuthGuard's own tests (src/navigation/authGuard.test.ts, app/_layout.test.tsx),
// which is where the real navigator lives.
const mockRedirect = jest.fn();
jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

describe("IndexRoute", () => {
  it("redirects to /splash -- the real splash screen, not this file", () => {
    render(<IndexRoute />);

    expect(mockRedirect).toHaveBeenCalledWith("/splash");
  });
});
