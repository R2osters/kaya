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
    for (const [key, value] of Object.entries({ ...fr, ...en })) {
      expect(typeof value === "string" && value.length > 0).toBe(true);
      expect(key.startsWith("@")).toBe(false);
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
});
