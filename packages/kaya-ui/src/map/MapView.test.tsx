import { render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";
import { colors } from "../theme";
import type { MapProviderComponent, MapViewProps } from "./MapView";

// MapView keeps its registered provider in module-level state (mirrors the
// Dart original's static `MapView.factory`, see map_view.dart). Jest only
// resets the module registry once per test FILE, not per `it` within one --
// so without this, registerMapProvider() in one test would leak into the
// next. jest.resetModules() plus a fresh require per test gives every test
// its own, unregistered copy of the module.
let MapViewModule: typeof import("./MapView");

beforeEach(() => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapViewModule = require("./MapView") as typeof import("./MapView");
});

function FakeProvider(props: MapViewProps) {
  return (
    <View testID="fake-provider">
      <Text testID="fake-center">{JSON.stringify(props.center ?? null)}</Text>
      <Text testID="fake-markers">{JSON.stringify(props.markers ?? [])}</Text>
      <Text testID="fake-route">{JSON.stringify(props.route ?? [])}</Text>
    </View>
  );
}

describe("MapView", () => {
  it("has no provider registered by default", () => {
    expect(MapViewModule.hasMapProvider()).toBe(false);
  });

  it("renders the stylized fallback when no provider is registered", () => {
    render(<MapViewModule.MapView testID="map" />);

    expect(screen.getByTestId("map")).toBeTruthy();
    expect(screen.queryByTestId("fake-provider")).toBeNull();
  });

  it("renders the registered provider, passing center/markers/route through unchanged", () => {
    MapViewModule.registerMapProvider(FakeProvider as MapProviderComponent);
    const center = { lat: 5.6, lng: -0.19 };
    const markers = [MapViewModule.pickupMarker({ lat: 5.61, lng: -0.2 }, "Pickup")];
    const route = [
      { lat: 5.6, lng: -0.19 },
      { lat: 5.61, lng: -0.2 },
    ];

    render(<MapViewModule.MapView center={center} markers={markers} route={route} testID="map" />);

    expect(MapViewModule.hasMapProvider()).toBe(true);
    expect(screen.getByTestId("fake-provider")).toBeTruthy();
    expect(JSON.parse(screen.getByTestId("fake-center").props.children as string)).toEqual(center);
    expect(JSON.parse(screen.getByTestId("fake-markers").props.children as string)).toEqual(markers);
    expect(JSON.parse(screen.getByTestId("fake-route").props.children as string)).toEqual(route);
  });

  it("registering a second provider replaces the first rather than stacking", () => {
    function ProviderOne() {
      return <View testID="provider-one" />;
    }
    function ProviderTwo() {
      return <View testID="provider-two" />;
    }

    MapViewModule.registerMapProvider(ProviderOne);
    MapViewModule.registerMapProvider(ProviderTwo);
    render(<MapViewModule.MapView />);

    expect(screen.queryByTestId("provider-one")).toBeNull();
    expect(screen.getByTestId("provider-two")).toBeTruthy();
  });

  it("pickupMarker uses the pickup marker token", () => {
    const marker = MapViewModule.pickupMarker({ lat: 1, lng: 2 });

    expect(marker.color).toBe(colors.markerPickup);
    expect(marker.point).toEqual({ lat: 1, lng: 2 });
    expect(marker.isVehicle).toBeUndefined();
  });

  it("dropoffMarker uses the dropoff marker token", () => {
    const marker = MapViewModule.dropoffMarker({ lat: 1, lng: 2 }, "Client");

    expect(marker.color).toBe(colors.markerDropoff);
    expect(marker.label).toBe("Client");
  });

  it("vehicleMarker uses the primary token and flags isVehicle", () => {
    const marker = MapViewModule.vehicleMarker({ lat: 1, lng: 2 });

    expect(marker.color).toBe(colors.primary);
    expect(marker.isVehicle).toBe(true);
  });

  it("pickup and dropoff markers use distinct colors", () => {
    const pickup = MapViewModule.pickupMarker({ lat: 1, lng: 2 });
    const dropoff = MapViewModule.dropoffMarker({ lat: 1, lng: 2 });

    expect(pickup.color).not.toBe(dropoff.color);
  });
});
