import { render, screen } from "@testing-library/react-native";
import { KayaAvatar } from "./KayaAvatar";

describe("KayaAvatar", () => {
  it("shows first and last initials", () => {
    render(<KayaAvatar name="Kwame Mensah" />);
    expect(screen.getByText("KM")).toBeTruthy();
  });

  it("shows a single initial for a one-word name", () => {
    render(<KayaAvatar name="Ama" />);
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("takes the first and last of three words, not the first two", () => {
    render(<KayaAvatar name="Yaw Kofi Boateng" />);
    expect(screen.getByText("YB")).toBeTruthy();
  });

  it("ignores surrounding and repeated whitespace", () => {
    render(<KayaAvatar name="  Ama   Owusu  " />);
    expect(screen.getByText("AO")).toBeTruthy();
  });

  it("falls back to an icon with neither photo nor name", () => {
    render(<KayaAvatar testID="avatar" />);
    expect(screen.getByTestId("avatar-placeholder")).toBeTruthy();
  });

  it("prefers the photo over initials", () => {
    render(<KayaAvatar name="Ama Owusu" photoUrl="https://example.test/a.jpg" testID="avatar" />);
    expect(screen.queryByText("AO")).toBeNull();
    expect(screen.getByTestId("avatar-image")).toBeTruthy();
  });

  it("treats an empty photo url as no photo", () => {
    render(<KayaAvatar name="Ama Owusu" photoUrl="" />);
    expect(screen.getByText("AO")).toBeTruthy();
  });
});
