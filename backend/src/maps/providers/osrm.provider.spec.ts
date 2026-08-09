import { AppConfigService } from '../../config/app-config.service';
import { HaversineProvider } from './haversine.provider';
import { OsrmProvider } from './osrm.provider';

const ACCRA = { lat: 5.6037, lng: -0.187 };
const TEMA = { lat: 5.6698, lng: -0.0166 };

function buildProvider(baseUrl = 'https://router.example/'): {
  provider: OsrmProvider;
  haversine: HaversineProvider;
} {
  const config = {
    get: (key: string) => (key === 'OSRM_BASE_URL' ? baseUrl : ''),
  } as unknown as AppConfigService;
  const haversine = new HaversineProvider();
  return { provider: new OsrmProvider(config, haversine), haversine };
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

const OK_RESPONSE = {
  code: 'Ok',
  routes: [{ distance: 22941.6, duration: 1297.4 }],
};

describe('OsrmProvider', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('returns road distance in km, rounded to two decimals', async () => {
    mockFetch(OK_RESPONSE);
    const { provider } = buildProvider();

    const result = await provider.distance(ACCRA, TEMA);

    expect(result).toEqual({
      distanceKm: 22.94,
      durationMin: 22,
      source: 'osrm',
    });
  });

  it('disagrees with the haversine constant by more than a rounding error', async () => {
    // The reason this provider exists. On this route the 1.3 constant reads
    // ~15% long, and on a short dense-grid hop it reads short -- so the error
    // is not something a better constant removes.
    mockFetch(OK_RESPONSE);
    const { provider, haversine } = buildProvider();

    const road = await provider.distance(ACCRA, TEMA);
    const straight = await haversine.distance(ACCRA, TEMA);

    expect(straight.distanceKm).toBeGreaterThan(road.distanceKm * 1.1);
  });

  it('sends coordinates as lng,lat -- the opposite order from the rest of the codebase', async () => {
    // Getting this backwards does not error. It routes between two other
    // places and returns a confident, wrong answer.
    const fetchMock = mockFetch(OK_RESPONSE);
    const { provider } = buildProvider();

    await provider.distance(ACCRA, TEMA);

    const url = String((fetchMock.mock.calls[0] as [URL])[0]);
    expect(url).toContain('/route/v1/driving/-0.187,5.6037;-0.0166,5.6698');
  });

  it('asks for no route geometry, which is the bulk of the response body', async () => {
    const fetchMock = mockFetch(OK_RESPONSE);
    const { provider } = buildProvider();

    await provider.distance(ACCRA, TEMA);

    expect(String((fetchMock.mock.calls[0] as [URL])[0])).toContain('overview=false');
  });

  it('strips trailing slashes from the configured base URL', async () => {
    const fetchMock = mockFetch(OK_RESPONSE);
    const { provider } = buildProvider('https://router.example///');

    await provider.distance(ACCRA, TEMA);

    expect(String((fetchMock.mock.calls[0] as [URL])[0])).toContain(
      'https://router.example/route/v1/',
    );
  });

  it('falls back to haversine when the server errors, rather than failing the quote', async () => {
    mockFetch({}, false, 503);
    const { provider, haversine } = buildProvider();

    const result = await provider.distance(ACCRA, TEMA);

    expect(result.source).toBe('haversine');
    expect(result.distanceKm).toBe((await haversine.distance(ACCRA, TEMA)).distanceKm);
  });

  it('falls back when the request throws (timeout, DNS, offline)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timed out')) as unknown as typeof fetch;
    const { provider } = buildProvider();

    const result = await provider.distance(ACCRA, TEMA);

    expect(result.source).toBe('haversine');
  });

  it('falls back on NoRoute -- two points with no road between them', async () => {
    mockFetch({ code: 'NoRoute', routes: [] });
    const { provider } = buildProvider();

    const result = await provider.distance(ACCRA, TEMA);

    // A straight-line estimate is at least a number the caller can price, and
    // `source` records that it was not a real route.
    expect(result.source).toBe('haversine');
    expect(result.distanceKm).toBeGreaterThan(0);
  });

  it('falls back on a well-formed response carrying no distance', async () => {
    mockFetch({ code: 'Ok', routes: [{ duration: 100 }] });
    const { provider } = buildProvider();

    expect((await provider.distance(ACCRA, TEMA)).source).toBe('haversine');
  });

  it('reports a null duration rather than guessing when the server omits one', async () => {
    mockFetch({ code: 'Ok', routes: [{ distance: 5000 }] });
    const { provider } = buildProvider();

    const result = await provider.distance(ACCRA, TEMA);

    expect(result).toEqual({ distanceKm: 5, durationMin: null, source: 'osrm' });
  });

  it('never throws out of distance(), whatever the server returns', async () => {
    mockFetch('not json at all');
    const { provider } = buildProvider();

    // Order creation must not fail because a routing server misbehaved.
    await expect(provider.distance(ACCRA, TEMA)).resolves.toBeDefined();
  });
});
