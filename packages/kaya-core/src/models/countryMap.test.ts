import { COUNTRY_CODES } from "../money/currency";
import { COUNTRY_MAP_DEFAULTS, mapDefaultsFor } from "./countryMap";

describe("country map defaults", () => {
  it("covers every country the platform operates in", () => {
    // A country added to COUNTRY_CODES without an entry here would silently
    // open its users' maps on Accra -- the exact bug this table replaced.
    for (const code of COUNTRY_CODES) {
      expect(COUNTRY_MAP_DEFAULTS[code]).toBeDefined();
    }
  });

  it("opens each country on its own city, not on one shared coordinate", () => {
    const centres = COUNTRY_CODES.map((code) => {
      const { center } = COUNTRY_MAP_DEFAULTS[code];
      return `${center.lat},${center.lng}`;
    });

    expect(new Set(centres).size).toBe(COUNTRY_CODES.length);
  });

  it("puts each centre inside its own country's rough bounding box", () => {
    // Guards a transposed lat/lng or a copy-paste between rows: Lomé and
    // Cotonou are both on the same coast, so a swapped pair still looks
    // plausible on a map and is only wrong by a few hundred kilometres.
    const boxes = {
      GHA: { lat: [4.5, 11.2], lng: [-3.3, 1.2] },
      TGO: { lat: [6.0, 11.2], lng: [-0.2, 1.9] },
      BEN: { lat: [6.2, 12.5], lng: [0.7, 3.9] },
    } as const;

    for (const code of COUNTRY_CODES) {
      const { center } = COUNTRY_MAP_DEFAULTS[code];
      const box = boxes[code];
      expect(center.lat).toBeGreaterThanOrEqual(box.lat[0]);
      expect(center.lat).toBeLessThanOrEqual(box.lat[1]);
      expect(center.lng).toBeGreaterThanOrEqual(box.lng[0]);
      expect(center.lng).toBeLessThanOrEqual(box.lng[1]);
    }
  });

  it("opens at city level, not country level", () => {
    for (const code of COUNTRY_CODES) {
      expect(COUNTRY_MAP_DEFAULTS[code].zoom).toBeGreaterThanOrEqual(11);
    }
  });

  describe("mapDefaultsFor", () => {
    it("resolves a known country", () => {
      expect(mapDefaultsFor("TGO").cityName).toBe("Lomé");
      expect(mapDefaultsFor("BEN").cityName).toBe("Cotonou");
    });

    it("falls back rather than throwing on an unknown or absent code", () => {
      // A map that renders somewhere plausible is recoverable; one that throws
      // takes the screen with it, and the caller usually has a real position
      // arriving a second later anyway.
      expect(mapDefaultsFor(undefined).cityName).toBe("Accra");
      expect(mapDefaultsFor(null).cityName).toBe("Accra");
      expect(mapDefaultsFor("NGA").cityName).toBe("Accra");
    });
  });
});
