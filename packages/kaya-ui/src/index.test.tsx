import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { KayaAvatar, KayaButton, KayaCard, RatingStars, StatusPill } from "./index";

// The previous task shipped a manifest pointing at a barrel that did not
// exist, and nothing caught it. This suite renders each component reached
// only through the package root import, so a component missing from the
// barrel fails here rather than surfacing later as a broken app import.
describe("package entry point: components", () => {
  it("reaches KayaButton through the package root", () => {
    render(<KayaButton label="Publier" onPress={jest.fn()} testID="root-btn" />);
    expect(screen.getByTestId("root-btn")).toBeTruthy();
  });

  it("reaches KayaCard through the package root", () => {
    render(
      <KayaCard testID="root-card">
        <Text>root card</Text>
      </KayaCard>,
    );
    expect(screen.getByTestId("root-card")).toBeTruthy();
  });

  it("reaches StatusPill through the package root", () => {
    render(<StatusPill label="Livré" testID="root-pill" />);
    expect(screen.getByTestId("root-pill")).toBeTruthy();
  });

  it("reaches RatingStars through the package root", () => {
    render(<RatingStars value={3} testID="root-stars" />);
    expect(screen.getByTestId("root-stars")).toBeTruthy();
  });

  it("reaches KayaAvatar through the package root", () => {
    render(<KayaAvatar name="Ama Owusu" testID="root-avatar" />);
    expect(screen.getByTestId("root-avatar")).toBeTruthy();
  });
});
