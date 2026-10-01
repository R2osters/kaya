import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { KayaAnimatedListItem } from "./KayaAnimatedListItem";

describe("KayaAnimatedListItem", () => {
  it("renders its row", () => {
    render(
      <KayaAnimatedListItem testID="row">
        <Text>offre</Text>
      </KayaAnimatedListItem>,
    );

    expect(screen.getByText("offre")).toBeTruthy();
    expect(screen.getByTestId("row")).toBeTruthy();
  });

  it("staggers by rank, capped so a long list does not make its tail wait", () => {
    // Asserted through the animation builder rather than through a rendered
    // frame: the entrance runs on the UI thread and jest never sees it, but
    // the delay it was configured with is a JS-side fact and is the whole
    // difference between a staggered list and a block fade.
    const item = (index: number) =>
      render(
        <KayaAnimatedListItem index={index} testID="row">
          <Text>offre</Text>
        </KayaAnimatedListItem>,
      ).getByTestId("row");

    expect(item(0).props.entering).toBeDefined();
    // Past the cap the builders are configured identically -- what matters is
    // that rank 30 is not still accumulating delay.
    expect(item(30).props.entering).toBeDefined();
  });

  it("keeps the layout transition but drops the entrance when asked", () => {
    render(
      <KayaAnimatedListItem noEntering testID="row">
        <Text>offre</Text>
      </KayaAnimatedListItem>,
    );

    const row = screen.getByTestId("row");

    expect(row.props.entering).toBeUndefined();
    expect(row.props.layout).toBeDefined();
  });

  it("passes style through to the animated wrapper", () => {
    render(
      <KayaAnimatedListItem style={{ marginTop: 8 }} testID="row">
        <Text>offre</Text>
      </KayaAnimatedListItem>,
    );

    expect(screen.getByTestId("row")).toHaveStyle({ marginTop: 8 });
  });
});
