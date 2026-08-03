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

  it("leaves no unsubstituted braces once every placeholder is supplied", () => {
    const i18n = createI18n("fr");
    const vars = { count: 1, min: 1, km: 1, range: "1-6", number: 1, pct: "20%" };
    for (const key of Object.keys(fr)) {
      expect(`${key}:${i18n.t(key, vars)}`).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });
});
