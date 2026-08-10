import { __testing } from "./MapLibreMapView";

const { boundsOf, MIN_BOUNDS_SPAN_DEG, BOUNDS_PADDING_RATIO } = __testing;

/**
 * The floor is built by adding half a span to each side of a zero-width box,
 * so the result lands a few ULPs short of the constant (0.009999999999999787
 * rather than 0.01) -- the same IEEE-754 drift `roundMoney` documents in
 * @kaya/core, here in degrees rather than currency. A strict `>=` fails on
 * arithmetic, not on behaviour, so the assertion carries one ULP of slack.
 */
function expectAtLeastMinSpan(span: number): void {
  expect(span).toBeGreaterThanOrEqual(MIN_BOUNDS_SPAN_DEG - Number.EPSILON * 100);
}

// Importing this module is safe under Jest: the native maplibre package is
// resolved lazily, inside the component, so nothing loads until a render.

const ACCRA = { lat: 5.6037, lng: -0.187 };
const OSU = { lat: 5.5606, lng: -0.1824 };
const TEMA = { lat: 5.6698, lng: -0.0166 };

describe("boundsOf", () => {
  it("returns null for no points -- there is no box to fit", () => {
    expect(boundsOf([])).toBeNull();
  });

  it("returns null for one point, which is a centre rather than a box", () => {
    expect(boundsOf([ACCRA])).toBeNull();
  });

  it("returns [west, south, east, north] -- MapLibre's order, not lat-first", () => {
    // Getting this order wrong does not error; it fits a box on the other side
    // of the equator and the map looks blank.
    const [west, south, east, north] = boundsOf([OSU, TEMA])!;

    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    // Longitudes in Accra are negative, latitudes positive: a transposed
    // result would put a negative number in a latitude slot.
    expect(west).toBeLessThan(0);
    expect(south).toBeGreaterThan(0);
  });

  it("contains every point it was given", () => {
    const points = [OSU, TEMA, ACCRA];
    const [west, south, east, north] = boundsOf(points)!;

    for (const point of points) {
      expect(point.lng).toBeGreaterThanOrEqual(west);
      expect(point.lng).toBeLessThanOrEqual(east);
      expect(point.lat).toBeGreaterThanOrEqual(south);
      expect(point.lat).toBeLessThanOrEqual(north);
    }
  });

  it("pads the box so pins do not sit against the edge", () => {
    const [west, south, east, north] = boundsOf([OSU, TEMA])!;

    const rawWest = Math.min(OSU.lng, TEMA.lng);
    const rawEast = Math.max(OSU.lng, TEMA.lng);
    const rawSouth = Math.min(OSU.lat, TEMA.lat);
    const rawNorth = Math.max(OSU.lat, TEMA.lat);

    expect(west).toBeLessThan(rawWest);
    expect(east).toBeGreaterThan(rawEast);
    expect(south).toBeLessThan(rawSouth);
    expect(north).toBeGreaterThan(rawNorth);
    expect(east - west).toBeCloseTo(
      (rawEast - rawWest) * (1 + 2 * BOUNDS_PADDING_RATIO),
      4,
    );
  });

  it("keeps a readable span for two points a few metres apart", () => {
    // A driver who has just arrived at the pickup. Without a floor the camera
    // zooms to street furniture.
    const here = { lat: 5.6037, lng: -0.187 };
    const almostHere = { lat: 5.60371, lng: -0.18701 };

    const [west, south, east, north] = boundsOf([here, almostHere])!;

    expectAtLeastMinSpan(east - west);
    expectAtLeastMinSpan(north - south);
  });

  it("keeps a readable span for two identical points", () => {
    const [west, south, east, north] = boundsOf([ACCRA, ACCRA])!;

    expectAtLeastMinSpan(east - west);
    expectAtLeastMinSpan(north - south);
  });

  it("is order-independent", () => {
    expect(boundsOf([OSU, TEMA, ACCRA])).toEqual(boundsOf([TEMA, ACCRA, OSU]));
  });

  it("fits the three showcase markers, which a fixed zoom did not", () => {
    // The device run that prompted this: pickup, dropoff and vehicle spread
    // over ~6 km rendered as exactly one visible pin.
    const pickup = { lat: 5.6037, lng: -0.187 };
    const dropoff = { lat: 5.55, lng: -0.21 };
    const vehicle = { lat: 5.58, lng: -0.2 };

    const [west, south, east, north] = boundsOf([pickup, dropoff, vehicle])!;

    for (const point of [pickup, dropoff, vehicle]) {
      expect(point.lng).toBeGreaterThan(west);
      expect(point.lng).toBeLessThan(east);
      expect(point.lat).toBeGreaterThan(south);
      expect(point.lat).toBeLessThan(north);
    }
  });

  it("handles points spanning the antimeridian without inverting the box", () => {
    // Not a Kaya case, but a silently wrong box here would be invisible: the
    // fit simply covers the whole planet the wrong way round. Documented as
    // the known limit rather than silently mis-handled.
    const [west, , east] = boundsOf([
      { lat: 0, lng: 179 },
      { lat: 0, lng: -179 },
    ])!;

    // The naive min/max spans the long way. Kaya operates in one hemisphere,
    // so this is recorded, not corrected.
    expect(west).toBeLessThan(east);
  });
});
