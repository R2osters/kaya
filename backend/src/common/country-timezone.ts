import { CountryCode } from '@prisma/client';

/** IANA timezone per country, used for local-midnight commission resets. */
export const COUNTRY_TIMEZONE: Record<CountryCode, string> = {
  [CountryCode.GHA]: 'Africa/Accra',
  [CountryCode.TGO]: 'Africa/Lome',
  [CountryCode.BEN]: 'Africa/Porto-Novo',
};

/** Current local calendar date (YYYY-MM-DD) in the given country's timezone. */
export function localDateInCountry(country: CountryCode, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COUNTRY_TIMEZONE[country],
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Timezone offset (ms) of a zone at a given instant: localWallClock - UTC. */
function tzOffsetMs(timeZone: string, at: Date): number {
  // Compare the same instant rendered in UTC vs in the target zone.
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
  const zoned = new Date(at.toLocaleString('en-US', { timeZone }));
  return zoned.getTime() - utc.getTime();
}

/**
 * UTC instant of the start of the current local day (local midnight) for a
 * country. Used for tz-aware "today" boundaries (settlement ordinal, one
 * withdrawal per day, today's earnings). West-African zones have no DST.
 */
export function localDayStartUtc(country: CountryCode, now = new Date()): Date {
  const tz = COUNTRY_TIMEZONE[country];
  const localDate = localDateInCountry(country, now); // YYYY-MM-DD (local)
  const offset = tzOffsetMs(tz, now);
  // Local midnight in UTC = (that calendar date at 00:00 UTC) - offset.
  return new Date(Date.parse(`${localDate}T00:00:00Z`) - offset);
}
