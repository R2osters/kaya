import { render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";
import { colors } from "../theme";
import {
  MapView,
  dropoffMarker,
  hasMapProvider,
  pickupMarker,
  registerMapProvider,
  resetMapProvider,
  vehicleMarker,
  type MapProviderComponent,
  type MapViewProps,
} from "./MapView";

// MapView keeps its registered provider in module-level state (mirrors the
// Dart original's static `MapView.factory`, see map_view.dart), and Jest
// resets the module registry once per test FILE, not per `it`. This file used
// to work around that with jest.resetModules() plus a fresh require in
// beforeEach, which meant nothing here could use a plain import. resetMapProvider()
// clears the one variable that actually needs clearing, so the imports above
// are ordinary again -- and the same call is what app test suites use instead
// of reaching for resetModules themselves.
beforeEach(() => {
  resetMapProvider();
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
    expect(hasMapProvider()).toBe(false);
  });

  it("renders the stylized fallback when no provider is registered", () => {
    render(<MapView testID="map" />);

    expect(screen.getByTestId("map")).toBeTruthy();
    expect(screen.queryByTestId("fake-provider")).toBeNull();
  });

  it("renders the registered provider, passing center/markers/route through unchanged", () => {
    registerMapProvider(FakeProvider as MapProviderComponent);
    const center = { lat: 5.6, lng: -0.19 };
    const markers = [pickupMarker({ lat: 5.61, lng: -0.2 }, "Pickup")];
    const route = [
      { lat: 5.6, lng: -0.19 },
      { lat: 5.61, lng: -0.2 },
    ];

    render(<MapView center={center} markers={markers} route={route} testID="map" />);

    expect(hasMapProvider()).toBe(true);
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

    registerMapProvider(ProviderOne);
    registerMapProvider(ProviderTwo);
    render(<MapView />);

    expect(screen.queryByTestId("provider-one")).toBeNull();
    expect(screen.getByTestId("provider-two")).toBeTruthy();
  });

  it("resetMapProvider drops the registration and restores the fallback", () => {
    registerMapProvider(FakeProvider as MapProviderComponent);
    expect(hasMapProvider()).toBe(true);

    resetMapProvider();

    expect(hasMapProvider()).toBe(false);
    render(<MapView testID="map" />);
    expect(screen.getByTestId("map")).toBeTruthy();
    expect(screen.queryByTestId("fake-provider")).toBeNull();
  });

  it("resetMapProvider is safe to call when nothing is registered", () => {
    expect(() => {
      resetMapProvider();
      resetMapProvider();
    }).not.toThrow();
    expect(hasMapProvider()).toBe(false);
  });

  it("pickupMarker uses the pickup marker token", () => {
    const marker = pickupMarker({ lat: 1, lng: 2 });

    expect(marker.color).toBe(colors.markerPickup);
    expect(marker.point).toEqual({ lat: 1, lng: 2 });
    expect(marker.isVehicle).toBeUndefined();
  });

  it("dropoffMarker uses the dropoff marker token", () => {
    const marker = dropoffMarker({ lat: 1, lng: 2 }, "Client");

    expect(marker.color).toBe(colors.markerDropoff);
    expect(marker.label).toBe("Client");
  });

  it("vehicleMarker uses the primary token and flags isVehicle", () => {
    const marker = vehicleMarker({ lat: 1, lng: 2 });

    expect(marker.color).toBe(colors.primary);
    expect(marker.isVehicle).toBe(true);
  });

  it("pickup and dropoff markers use distinct colors", () => {
    const pickup = pickupMarker({ lat: 1, lng: 2 });
    const dropoff = dropoffMarker({ lat: 1, lng: 2 });

    expect(pickup.color).not.toBe(dropoff.color);
  });
});
