import en from "./en.json";
import fr from "./fr.json";
import { SUPPORTED_LOCALES, createI18n } from "./index";

describe("translation resources", () => {
  it("ships French and English", () => {
    expect(SUPPORTED_LOCALES).toEqual(["fr", "en"]);
  });

  it("has the same key set in both languages", () => {
    const frKeys = Object.keys(fr).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it("has no empty translations", () => {
    // Checked per language: spreading both into one object would let every
    // English value overwrite its French twin, so a blank French string with a
    // filled English one would slip through.
    for (const [language, table] of [
      ["fr", fr],
      ["en", en],
    ] as const) {
      for (const [key, value] of Object.entries(table)) {
        expect(key.startsWith("@")).toBe(false);
        expect(`${language}.${key}=${String(value)}`).toMatch(/=\S/);
      }
    }
  });

  it("uses the same placeholders in both languages", () => {
    // A placeholder present in one language only renders as literal braces in
    // the other, which is worse than an untranslated string.
    const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    for (const key of Object.keys(fr)) {
      const f = (fr as Record<string, string>)[key] ?? "";
      const e = (en as Record<string, string>)[key] ?? "";
      expect({ key, p: placeholders(e) }).toEqual({ key, p: placeholders(f) });
    }
  });
});

describe("createI18n", () => {
  // createI18n initialises synchronously from bundled resources — there is no
  // backend to await, so the language is already set when it returns.
  it("defaults to French", () => {
    expect(createI18n().language).toBe("fr");
  });

  it("switches language", () => {
    expect(createI18n("en").language).toBe("en");
  });

  it("translates a known key in both languages", () => {
    const key = Object.keys(fr)[0] as string;
    expect(createI18n("fr").t(key)).toBe((fr as Record<string, string>)[key]);
    expect(createI18n("en").t(key)).toBe((en as Record<string, string>)[key]);
  });

  it("substitutes the ARB single-brace placeholders", () => {
    // i18next defaults to {{var}}; the ARB files use ICU {var}. Without the
    // delimiters being reconfigured, every count, distance and percentage
    // string renders its placeholder literally on screen.
    const fi = createI18n("fr");
    expect(fi.t("offersTrips", { count: 318 })).toBe("318 courses");
    expect(fi.t("commonKm", { km: "6.2" })).toBe("6.2 km");
    expect(fi.t("offersMinAway", { min: 8 })).toBe("8 min");
    expect(fi.t("driverTierLine", { number: 7, pct: 15 })).toBe(
      "Livraison n°7 du jour — palier 15%.",
    );

    const ei = createI18n("en");
    expect(ei.t("offersTrips", { count: 318 })).toBe("318 trips");
  });

  it("substitutes every placeholder of every string in both languages", () => {
    // The variable bag is derived from each string rather than hardcoded. A
    // fixed bag would prove nothing about a placeholder added later: i18next
    // replaces an unsupplied variable with an empty string rather than leaving
    // the braces, so the value would silently vanish and a brace-hunting
    // assertion would still pass.
    for (const [language, table] of [
      ["fr", fr],
      ["en", en],
    ] as const) {
      const i18n = createI18n(language);
      for (const [key, raw] of Object.entries(table as Record<string, string>)) {
        const names = raw.match(/\{([a-zA-Z]+)\}/g) ?? [];
        const vars = Object.fromEntries(
          names.map((n) => [n.slice(1, -1), `<${n.slice(1, -1)}>`]),
        );
        const rendered = i18n.t(key, vars);

        expect(`${language}.${key}=${rendered}`).not.toMatch(/\{[a-zA-Z]+\}/);
        // Every placeholder's value must appear, so an unsupplied variable
        // collapsing to an empty string cannot pass unnoticed.
        for (const name of Object.keys(vars)) {
          expect(`${language}.${key}=${rendered}`).toContain(`<${name}>`);
        }
      }
    }
  });
});
