/**
 * Country and currency metadata. Wire spellings (GHA, GHS, …) are the exact
 * strings the backend sends — they are compared verbatim, never lowercased.
 */

export const COUNTRY_CODES = ["GHA", "TGO", "BEN"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

/** NGN is display-only (v2 parking lot) but must parse if the API sends it. */
export const CURRENCIES = ["GHS", "XOF", "NGN"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface CountryMeta {
  readonly code: CountryCode;
  readonly displayName: string;
  readonly flag: string;
  readonly currency: Currency;
}

export const COUNTRIES: Record<CountryCode, CountryMeta> = {
  GHA: { code: "GHA", displayName: "Ghana", flag: "🇬🇭", currency: "GHS" },
  TGO: { code: "TGO", displayName: "Togo", flag: "🇹🇬", currency: "XOF" },
  BEN: { code: "BEN", displayName: "Bénin", flag: "🇧🇯", currency: "XOF" },
};

export function currencyForCountry(code: CountryCode): Currency {
  return COUNTRIES[code].currency;
}

/** XOF is a zero-decimal currency; GHS and NGN use two. */
export function currencyDecimals(currency: Currency): number {
  return currency === "XOF" ? 0 : 2;
}

export function parseCountryCode(value: unknown): CountryCode {
  return COUNTRY_CODES.includes(value as CountryCode)
    ? (value as CountryCode)
    : "GHA";
}

export function parseCurrency(value: unknown): Currency {
  return CURRENCIES.includes(value as Currency) ? (value as Currency) : "GHS";
}

/**
 * Formats money in the design's "amount then code" style: "50.00 GHS",
 * "1 200 XOF". XOF uses French grouping, the others US grouping — mirroring
 * the NumberFormat locales the Flutter build used.
 */
export function formatMoney(
  amount: number,
  currency: Currency,
  opts: { withSymbol?: boolean } = {},
): string {
  const decimals = currencyDecimals(currency);
  const locale = currency === "XOF" ? "fr-FR" : "en-US";
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return opts.withSymbol === false ? number : `${number} ${currency}`;
}
