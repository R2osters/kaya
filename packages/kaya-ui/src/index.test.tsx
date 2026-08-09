import { render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";
import {
  BottomSheetShell,
  colors,
  dropoffMarker,
  EmptyState,
  hasMapProvider,
  ImageAdapter,
  KayaAvatar,
  KayaButton,
  KayaCard,
  KayaI18nProvider,
  KayaSkeleton,
  KayaSkeletonCard,
  KayaSkeletonList,
  KayaSkeletonListTile,
  KayaTextField,
  LocationAdapter,
  MapLibreMapView,
  MapView,
  pickupMarker,
  StylizedMapFallback,
  vehicleMarker,
  PushAdapter,
  RatingStars,
  registerMapProvider,
  resetMapProvider,
  SecureTokenStore,
  StatusPill,
  useLocale,
} from "./index";

// expo-secure-store's native module is not available under jest; only the
// SecureTokenStore reachability test below touches it, and it is mocked the
// same way src/adapters/SecureTokenStore.test.ts mocks it.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
}));

// Same rationale, for the LocationAdapter and ImageAdapter reachability
// tests below -- mocked identically to their own adapter test files.
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
}));

// Same rationale, for the PushAdapter reachability test below -- mocked
// identically to src/adapters/PushAdapter.test.ts.
jest.mock("@react-native-firebase/messaging", () => ({
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3 },
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
  hasPermission: jest.fn().mockResolvedValue(0),
  onMessage: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
  onTokenRefresh: jest.fn(),
  requestPermission: jest.fn(),
}));

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

  it("reaches KayaTextField through the package root", () => {
    render(<KayaTextField value="" onChangeText={jest.fn()} testID="root-field" />);
    expect(screen.getByTestId("root-field")).toBeTruthy();
  });

  it("reaches EmptyState through the package root", () => {
    render(<EmptyState icon={<Text>icon</Text>} title="Vide" testID="root-empty" />);
    expect(screen.getByTestId("root-empty")).toBeTruthy();
  });

  it("reaches BottomSheetShell through the package root", () => {
    render(
      <BottomSheetShell visible onClose={jest.fn()} testID="root-sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    expect(screen.getByTestId("root-sheet")).toBeTruthy();
  });

  it("reaches KayaSkeleton through the package root", () => {
    render(<KayaSkeleton testID="root-skeleton" />);
    expect(screen.getByTestId("root-skeleton")).toBeTruthy();
  });

  it("reaches KayaSkeletonListTile through the package root", () => {
    render(<KayaSkeletonListTile testID="root-skeleton-tile" />);
    // These composites group themselves out of the accessibility tree
    // (importantForAccessibility="no-hide-descendants") so a screen reader
    // announces "busy" once instead of once per box; RNTL hides that
    // subtree from default queries too, so opt back in here.
    expect(screen.getByTestId("root-skeleton-tile", { includeHiddenElements: true })).toBeTruthy();
  });

  it("reaches KayaSkeletonList through the package root", () => {
    render(<KayaSkeletonList testID="root-skeleton-list" />);
    expect(screen.getByTestId("root-skeleton-list", { includeHiddenElements: true })).toBeTruthy();
  });

  it("reaches KayaSkeletonCard through the package root", () => {
    render(<KayaSkeletonCard testID="root-skeleton-card" />);
    expect(screen.getByTestId("root-skeleton-card", { includeHiddenElements: true })).toBeTruthy();
  });

  it("reaches SecureTokenStore through the package root", async () => {
    const store = new SecureTokenStore();
    await expect(store.readAccess()).resolves.toBeNull();
  });

  it("reaches LocationAdapter through the package root", async () => {
    const adapter = new LocationAdapter();
    await expect(adapter.requestPermission()).resolves.toBe("denied");
  });

  it("reaches ImageAdapter through the package root", async () => {
    const adapter = new ImageAdapter();
    await expect(adapter.pickFromLibrary()).resolves.toBeNull();
  });

  it("reaches PushAdapter through the package root", async () => {
    const adapter = new PushAdapter();
    await expect(adapter.getToken()).resolves.toBeNull();
  });

  it("reaches MapView through the package root, rendering the fallback with no provider registered", () => {
    render(<MapView testID="root-map" />);
    expect(screen.getByTestId("root-map")).toBeTruthy();
  });

  it("reaches the marker constructors through the package root", () => {
    expect(pickupMarker({ lat: 5.6, lng: -0.19 }).color).toBe(colors.markerPickup);
    expect(dropoffMarker({ lat: 5.6, lng: -0.19 }).color).toBe(colors.markerDropoff);

    const vehicle = vehicleMarker({ lat: 5.6, lng: -0.19 });
    expect(vehicle.color).toBe(colors.primary);
    expect(vehicle.isVehicle).toBe(true);
  });

  it("reaches StylizedMapFallback through the package root", () => {
    // The fallback is what makes both apps runnable with no API key at all, so
    // an app must be able to reach it deliberately, not only get it by default.
    render(<StylizedMapFallback testID="root-fallback" />);
    expect(screen.getByTestId("root-fallback")).toBeTruthy();
  });

  it("reaches the map registry and MapLibreMapView through the package root", () => {
    // MapLibreMapView is not rendered here. The package is installed now
    // (phase 1C), but it is a native module: rendering it resolves
    // @maplibre/maplibre-react-native, which throws under Jest with no native
    // bridge linked. Its *types* are what the compiler now checks against the
    // real package -- see MapLibreMapView.tsx. This asserts the export shape,
    // the same thing the rest of this suite asserts for every other export.
    expect(typeof registerMapProvider).toBe("function");
    expect(typeof hasMapProvider).toBe("function");
    expect(typeof resetMapProvider).toBe("function");
    expect(typeof MapLibreMapView).toBe("function");
  });

  it("resetMapProvider, reached through the package root, undoes a registration", () => {
    // This is the call app test suites use in place of jest.resetModules().
    registerMapProvider(() => <View testID="root-registered" />);
    expect(hasMapProvider()).toBe(true);

    resetMapProvider();

    expect(hasMapProvider()).toBe(false);
  });

  it("reaches KayaI18nProvider and useLocale through the package root", () => {
    function Probe() {
      const { locale } = useLocale();
      return <Text testID="root-locale">{locale}</Text>;
    }

    render(
      <KayaI18nProvider>
        <Probe />
      </KayaI18nProvider>,
    );
    expect(screen.getByTestId("root-locale").props.children).toBe("fr");
  });
});
