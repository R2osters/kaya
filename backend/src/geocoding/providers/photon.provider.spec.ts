import { AppConfigService } from '../../config/app-config.service';
import { PhotonProvider } from './photon.provider';
import { StaticGeocodingProvider } from './static.provider';

function buildProvider(baseUrl = 'https://photon.example') {
  const config = {
    get: (key: string) => (key === 'PHOTON_BASE_URL' ? baseUrl : ''),
  } as unknown as AppConfigService;
  return new PhotonProvider(config, new StaticGeocodingProvider());
}

function mockFetch(body: unknown, ok = true, status = 200): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** The shape the live service returns for "Osu Accra", trimmed to the fields read. */
const OSU_RESPONSE = {
  features: [
    {
      geometry: { type: 'Point', coordinates: [-0.1824391, 5.5605929] },
      properties: {
        name: 'Osu',
        city: 'Accra',
        state: 'Greater Accra Region',
        country: 'Ghana',
        countrycode: 'GH',
      },
    },
  ],
};

describe('PhotonProvider', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('maps a GeoJSON feature to a suggestion', async () => {
    mockFetch(OSU_RESPONSE);

    const [first] = await buildProvider().search({ text: 'Osu Accra' });

    expect(first).toEqual({
      label: 'Osu, Accra, Greater Accra Region',
      name: 'Osu',
      city: 'Accra',
      countryCode: 'GH',
      lat: 5.5605929,
      lng: -0.1824391,
    });
  });

  it('reads coordinates as [lng, lat], the GeoJSON order', async () => {
    // Transposing these does not error; it returns a pin off the coast of
    // Ghana and prices the delivery from there.
    mockFetch(OSU_RESPONSE);

    const [first] = await buildProvider().search({ text: 'Osu' });

    expect(first?.lat).toBeCloseTo(5.56, 2);
    expect(first?.lng).toBeCloseTo(-0.18, 2);
  });

  it('drops a feature with no usable coordinates rather than defaulting them', async () => {
    mockFetch({
      features: [
        { geometry: { coordinates: [] }, properties: { name: 'Nowhere' } },
        ...OSU_RESPONSE.features,
      ],
    });

    const results = await buildProvider().search({ text: 'Osu' });

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Osu');
  });

  it('drops a nameless feature', async () => {
    mockFetch({
      features: [{ geometry: { coordinates: [1, 2] }, properties: {} }],
    });

    await expect(buildProvider().search({ text: 'anything' })).resolves.toEqual([]);
  });

  it('deduplicates the label when a place is its own city', async () => {
    mockFetch({
      features: [
        {
          geometry: { coordinates: [-0.187, 5.6037] },
          properties: { name: 'Accra', city: 'Accra', country: 'Ghana', countrycode: 'GH' },
        },
      ],
    });

    const [first] = await buildProvider().search({ text: 'Accra' });

    expect(first?.label).toBe('Accra, Ghana');
  });

  it('sends the query, the language and the country filter', async () => {
    const fetchMock = mockFetch(OSU_RESPONSE);

    await buildProvider().search({ text: 'Osu', language: 'fr', countryCode: 'GH' });

    const url = String((fetchMock.mock.calls[0] as [URL])[0]);
    expect(url).toContain('q=Osu');
    expect(url).toContain('lang=fr');
    expect(url).toContain('countrycodes=gh');
  });

  it('clamps the limit so a caller cannot ask for an unbounded page', async () => {
    const fetchMock = mockFetch(OSU_RESPONSE);

    await buildProvider().search({ text: 'Osu', limit: 500 });

    expect(String((fetchMock.mock.calls[0] as [URL])[0])).toContain('limit=10');
  });

  it('drops a result from another country even when the server ignored the filter', async () => {
    // The country param is advisory on some Photon builds, so the filter is
    // enforced again on the parsed results.
    mockFetch({
      features: [
        ...OSU_RESPONSE.features,
        {
          geometry: { coordinates: [2.35, 48.85] },
          properties: { name: 'Accra', city: 'Paris', country: 'France', countrycode: 'FR' },
        },
      ],
    });

    const results = await buildProvider().search({ text: 'Accra', countryCode: 'GH' });

    expect(results.map((r) => r.countryCode)).toEqual(['GH']);
  });

  it('makes no request below three characters', async () => {
    const fetchMock = mockFetch(OSU_RESPONSE);

    await expect(buildProvider().search({ text: 'Os' })).resolves.toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the static landmarks when the service errors', async () => {
    // A dead-ending address field halfway through creating an order is worse
    // than a short list of real landmarks.
    mockFetch({}, false, 502);

    const results = await buildProvider().search({ text: 'Osu' });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.name).toBe('Osu');
  });

  it('falls back when the request throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    await expect(buildProvider().search({ text: 'Makola' })).resolves.toHaveLength(1);
  });

  it('never throws, whatever the service returns', async () => {
    mockFetch('not geojson');

    await expect(buildProvider().search({ text: 'Osu' })).resolves.toBeDefined();
  });
});
