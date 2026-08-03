import { render, screen } from "@testing-library/react-native";
import { StatusPill } from "./StatusPill";
import { colors } from "../theme";

describe("StatusPill", () => {
  it.each([
    ["primary", colors.primaryTint, colors.primary],
    ["success", colors.successTint, colors.success],
    ["danger", colors.dangerTint, colors.danger],
    ["amber", colors.amberTint, colors.amber],
    ["neutral", colors.background, colors.inkSecondary],
  ] as const)("pairs the %s tone with its tint", (tone, bg, fg) => {
    render(<StatusPill label="Livré" tone={tone} testID="pill" />);
    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: bg });
    expect(screen.getByText("Livré")).toHaveStyle({ color: fg });
  });

  it("tightens its padding when dense", () => {
    render(<StatusPill label="En route" dense testID="pill" />);
    expect(screen.getByTestId("pill")).toHaveStyle({ paddingHorizontal: 10, paddingVertical: 4 });
  });

  it("defaults to the primary tone", () => {
    render(<StatusPill label="Publiée" testID="pill" />);
    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: colors.primaryTint });
  });
});
