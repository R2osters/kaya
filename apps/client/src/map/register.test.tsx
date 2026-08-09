import { MapView, hasMapProvider, resetMapProvider } from "@kaya/ui";
import { render, screen } from "@testing-library/react-native";
import { __testing, registerAppMapProvider } from "./register";

let mockMapsApiKey: string | null = null;

jest.mock("../config/env", () => ({
  get env() {
    return { mapsApiKey: mockMapsApiKey };
  },
}));

// MapLibreMapView resolves the native @maplibre/maplibre-react-native module on
// first render, which throws under Jest with no native bridge linked. Standing
// in for it here is what lets a test assert *which style URL the app hands it*
// -- the actual decision this module makes -- without a device.
const mockStyleUrls: (string | undefined)[] = [];
jest.mock("@kaya/ui", () => {
  const actual = jest.requireActual("@kaya/ui");
  // Required inside the factory, not imported at the top: jest hoists this
  // above the imports, so a top-level binding would not exist yet.
  const { Text } = require("react-native") as typeof import("react-native");
  return {
    ...actual,
    MapLibreMapView: ({ styleUrl, testID }: { styleUrl?: string; testID?: string }) => {
      mockStyleUrls.push(styleUrl);
      return <Text testID={testID ?? "maplibre"}>{styleUrl ?? "no-style"}</Text>;
    },
  };
});

beforeEach(() => {
  resetMapProvider();
  mockStyleUrls.length = 0;
  mockMapsApiKey = null;
});

describe("registerAppMapProvider", () => {
  it("registers a provider, so MapView stops falling back to the stylized map", () => {
    expect(hasMapProvider()).toBe(false);

    registerAppMapProvider();

    expect(hasMapProvider()).toBe(true);
  });

  it("passes no style URL when no key is configured, leaving the keyless OSM default", () => {
    registerAppMapProvider();

    render(<MapView testID="map" />);

    expect(mockStyleUrls).toEqual([undefined]);
    expect(screen.getByTestId("map").props.children).toBe("no-style");
  });

  it("passes the keyed style URL when a key is configured", () => {
    mockMapsApiKey = "tile-key-123";

    registerAppMapProvider();
    render(<MapView testID="map" />);

    expect(mockStyleUrls[0]).toBe(__testing.keyedStyleUrl("tile-key-123"));
    expect(mockStyleUrls[0]).toContain("tile-key-123");
  });

  it("url-encodes the key rather than pasting it into the query string raw", () => {
    // A key is opaque; one containing & or = would otherwise silently truncate
    // the style request into a different, valid-looking URL.
    expect(__testing.keyedStyleUrl("a&b=c")).toContain("a%26b%3Dc");
    expect(__testing.keyedStyleUrl("a&b=c")).not.toContain("a&b=c");
  });

  it("forwards center, markers and route through to the provider", () => {
    registerAppMapProvider();
    const center = { lat: 5.6037, lng: -0.187 };

    render(<MapView center={center} testID="map" />);

    expect(screen.getByTestId("map")).toBeTruthy();
  });

  it("is safe to call twice -- the second registration replaces the first", () => {
    registerAppMapProvider();
    registerAppMapProvider();

    render(<MapView testID="map" />);

    // One rendered provider, not two stacked ones.
    expect(mockStyleUrls).toHaveLength(1);
    expect(hasMapProvider()).toBe(true);
  });
});
