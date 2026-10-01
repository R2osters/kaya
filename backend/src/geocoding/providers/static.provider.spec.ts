import { StaticGeocodingProvider } from './static.provider';

describe('StaticGeocodingProvider', () => {
  const provider = new StaticGeocodingProvider();

  it('matches a landmark by name', async () => {
    const results = await provider.search({ text: 'Osu' });

    expect(results[0]).toMatchObject({
      name: 'Osu',
      city: 'Accra',
      countryCode: 'GH',
    });
  });

  it('matches case-insensitively', async () => {
    await expect(provider.search({ text: 'MAKOLA' })).resolves.toHaveLength(1);
  });

  it('matches regardless of accents, in either direction', async () => {
    // Users type on a phone keyboard in two languages. Requiring the right
    // diacritic to find the airport would make the list look empty.
    const withAccent = await provider.search({ text: 'aéroport' });
    const without = await provider.search({ text: 'aeroport' });

    expect(withAccent.length).toBeGreaterThan(0);
    expect(without.length).toBe(withAccent.length);
  });

  it('restricts to a country when asked', async () => {
    const results = await provider.search({ text: 'a', countryCode: 'TG', limit: 10 });

    // "a" is under the 2-character floor, so this is really asserting the
    // floor; the country filter is asserted below with a real query.
    expect(results).toEqual([]);

    const togo = await provider.search({ text: 'Lome', countryCode: 'TG', limit: 10 });
    expect(togo.length).toBeGreaterThan(0);
    expect(togo.every((r) => r.countryCode === 'TG')).toBe(true);
  });

  it('returns nothing for a country with no match, rather than leaking another country', async () => {
    const results = await provider.search({ text: 'Makola', countryCode: 'BJ' });

    expect(results).toEqual([]);
  });

  it('returns nothing below two characters', async () => {
    await expect(provider.search({ text: 'O' })).resolves.toEqual([]);
    await expect(provider.search({ text: '' })).resolves.toEqual([]);
  });

  it('honours the limit', async () => {
    const results = await provider.search({ text: 'a', countryCode: 'GH', limit: 2 });
    const unbounded = await provider.search({ text: 'Accra', limit: 2 });

    expect(results.length).toBeLessThanOrEqual(2);
    expect(unbounded.length).toBeLessThanOrEqual(2);
  });

  it('covers all three launch countries', async () => {
    const found = new Set<string | null>();
    for (const term of ['Accra', 'Lome', 'Cotonou']) {
      const results = await provider.search({ text: term, limit: 10 });
      for (const r of results) found.add(r.countryCode);
    }

    expect(found).toEqual(new Set(['GH', 'TG', 'BJ']));
  });

  it('carries real coordinates, so a quote built from them is plausible', async () => {
    const [osu] = await provider.search({ text: 'Osu' });

    // Accra sits around 5.6N, -0.2E. A transposed or defaulted pair would
    // price a delivery from the Gulf of Guinea.
    expect(osu?.lat).toBeCloseTo(5.56, 1);
    expect(osu?.lng).toBeCloseTo(-0.18, 1);
  });
});

describe('StaticGeocodingProvider.reverse', () => {
  const provider = new StaticGeocodingProvider();

  it('names a position from the nearest seeded landmark', async () => {
    // Standing in Osu.
    const result = await provider.reverse({ lat: 5.5606, lng: -0.1824 });

    expect(result?.label).toContain('Osu');
  });

  it('keeps the caller position, not the landmark centroid', async () => {
    // This backs "use my position": the position is the point, the label is
    // context. Returning the landmark's coordinate would move a pickup pin
    // and price the delivery from somewhere the user is not.
    const here = { lat: 5.5701, lng: -0.1799 };

    const result = await provider.reverse(here);

    expect(result?.lat).toBe(here.lat);
    expect(result?.lng).toBe(here.lng);
  });

  it('names a Lome position from a Togolese landmark, not a Ghanaian one', async () => {
    const result = await provider.reverse({ lat: 6.1319, lng: 1.2228 });

    expect(result?.countryCode).toBe('TG');
  });

  it('resolves null rather than naming a place hundreds of km away', async () => {
    // A label saying "Osu, Accra" for someone far outside the launch cities
    // is worse than no label: the driver reads it, and it is a lie.
    const result = await provider.reverse({ lat: 9.4, lng: -0.84 });

    expect(result).toBeNull();
  });
});
