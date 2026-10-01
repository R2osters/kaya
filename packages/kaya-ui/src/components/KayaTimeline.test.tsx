import { render, screen } from "@testing-library/react-native";
import { KayaTimeline } from "./KayaTimeline";

describe("KayaTimeline", () => {
  it("renders one segment per step", () => {
    render(<KayaTimeline count={4} step={-1} testID="track" />);

    expect(screen.getByTestId("track-step-0")).toBeTruthy();
    expect(screen.getByTestId("track-step-3")).toBeTruthy();
    expect(screen.queryByTestId("track-step-4")).toBeNull();
  });

  it("suffixes completed segments with -done, and only those", () => {
    // The suffix is the contract four screens' tests already query. It stays a
    // rendering fact rather than an animated one on purpose: the fill itself
    // lives on the UI thread, where no test can read it.
    render(<KayaTimeline count={4} step={1} testID="track" />);

    expect(screen.getByTestId("track-step-0-done")).toBeTruthy();
    expect(screen.getByTestId("track-step-1-done")).toBeTruthy();
    expect(screen.queryByTestId("track-step-2-done")).toBeNull();
    expect(screen.getByTestId("track-step-2")).toBeTruthy();
  });

  it("fills every segment at the last step", () => {
    render(<KayaTimeline count={4} step={3} testID="track" />);

    expect(screen.getByTestId("track-step-3-done")).toBeTruthy();
  });

  it("announces itself as a progressbar carrying the caller's label", () => {
    render(
      <KayaTimeline count={4} step={1} accessibilityLabel="Suivi" testID="track" />,
    );

    const bar = screen.getByLabelText("Suivi");

    expect(bar.props.accessibilityRole).toBe("progressbar");
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 2 });
  });

  it("clamps an out-of-range step rather than reporting more than it has", () => {
    // A live status the screen does not recognise must not make the
    // progressbar announce 6 of 4.
    render(
      <KayaTimeline count={4} step={9} accessibilityLabel="Suivi" testID="track" />,
    );

    expect(screen.getByLabelText("Suivi").props.accessibilityValue.now).toBe(4);
  });

  it("emits no id of its own, so the screen's own wrapper id stays unique", () => {
    render(<KayaTimeline count={2} step={0} testID="track" />);

    expect(screen.queryByTestId("track")).toBeNull();
    expect(screen.queryByTestId("track-timeline")).toBeNull();
  });
});
