import {
  COUNTRIES,
  currencyDecimals,
  currencyForCountry,
  formatMoney,
  parseCountryCode,
  parseCurrency,
} from "./currency";

/** ICU emits U+00A0 / U+202F as group separators; normalise for stable assertions. */
const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("country and currency metadata", () => {
  it("maps each country to its currency", () => {
    expect(currencyForCountry("GHA")).toBe("GHS");
    expect(currencyForCountry("TGO")).toBe("XOF");
    expect(currencyForCountry("BEN")).toBe("XOF");
  });

  it("exposes a flag and display name per country", () => {
    expect(COUNTRIES.GHA.displayName).toBe("Ghana");
    expect(COUNTRIES.TGO.displayName).toBe("Togo");
    expect(COUNTRIES.BEN.displayName).toBe("Bénin");
    expect(COUNTRIES.GHA.flag).toBe("🇬🇭");
  });

  it("gives XOF zero decimals and the others two", () => {
    expect(currencyDecimals("XOF")).toBe(0);
    expect(currencyDecimals("GHS")).toBe(2);
    expect(currencyDecimals("NGN")).toBe(2);
  });

  it("falls back instead of throwing on unknown wire values", () => {
    expect(parseCountryCode("ZZZ")).toBe("GHA");
    expect(parseCountryCode(undefined)).toBe("GHA");
    expect(parseCurrency("ZZZ")).toBe("GHS");
  });
});

describe("formatMoney", () => {
  it("puts the code after the amount", () => {
    expect(norm(formatMoney(50, "GHS"))).toBe("50.00 GHS");
  });

  it("formats XOF without decimals and with grouped thousands", () => {
    expect(norm(formatMoney(1200, "XOF"))).toBe("1 200 XOF");
  });

  it("can omit the code", () => {
    expect(norm(formatMoney(1200, "XOF", { withSymbol: false }))).toBe("1 200");
  });
});
