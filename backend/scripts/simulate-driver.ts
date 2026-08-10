/**
 * A driver, simulated, so the client app's offers and tracking screens have
 * something real to react to before the driver app exists (phase 3).
 *
 * It drives the actual endpoints and the actual Socket.io gateway. That is the
 * point: the client's realtime bridge, map and timeline are then checked
 * against what the server really sends, not against invented data. It is also
 * kept for phase 3, as the control the real driver app is compared to.
 *
 * Requires a backend running with `FIREBASE_VERIFIER=mock`, which is the only
 * way to obtain a token without a Firebase project. It refuses to run against
 * anything that is not local -- see `assertLocal` below.
 *
 * Usage:
 *
 *   docker compose up -d
 *   npm run start:dev                 # in backend/
 *   npx tsx scripts/simulate-driver.ts
 *
 * It prints the client account to sign into the app with, then waits for an
 * order, bids on it, and once accepted walks the delivery from pickup to
 * delivered while emitting a position every 5 seconds.
 */
import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;

/** Seeded demo accounts. Created on first run, reused afterwards. */
const CLIENT = {
  email: 'client.demo@kaya.local',
  phone: '+233201111111',
  fullName: 'Ama Owusu',
  role: 'client',
};
const DRIVER = {
  email: 'driver.demo@kaya.local',
  phone: '+233202222222',
  fullName: 'Kofi Boateng',
  role: 'livreur',
  // Ghana requires a PCSRC licence number matching
  // /^PCSRC-\d{4}-\d{6}$/ and a QR code -- see src/auth/driver-validation.ts.
  // Registering a driver without them is rejected, which is worth knowing
  // before phase 3 builds the sign-up wizard for exactly these fields.
  driverLicenseNumber: 'PCSRC-2024-001234',
  driverQrCode: 'KAYA-DEMO-DRIVER-QR',
  vehicleType: 'moto',
};

/** Mirrors MOCK_PREFIX in src/auth/verifiers/mock.verifier.ts. */
const MOCK_TOKEN_PREFIX = 'kaya-mock-verifier:';

const COUNTRY_CODE = 'GHA';
const PASSWORD = 'DemoPass123!';

/**
 * A short route through Accra, from Osu towards Tema Station. Positions are
 * interpolated between these, so the marker moves along something shaped like
 * a road rather than teleporting.
 */
const ROUTE: Array<[number, number]> = [
  [5.5606, -0.1824],
  [5.5721, -0.1729],
  [5.5884, -0.1521],
  [5.6037, -0.187],
  [5.6202, -0.1104],
  [5.6455, -0.0642],
  [5.6698, -0.0166],
];

const POSITION_INTERVAL_MS = 5_000;
const POLL_INTERVAL_MS = 3_000;

/**
 * This script signs accounts in through the mock verifier, which is an
 * authentication bypass. Pointing it at a deployed backend would be pointing a
 * bypass at real users, so it refuses anything that is not a loopback host --
 * the same instinct as tools/devFlagGuard on the app side.
 */
function assertLocal(url: string): void {
  const host = new URL(url).hostname;
  const local =
    host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2' || host === '::1';
  if (!local) {
    throw new Error(
      `Refusing to run against ${host}. This script authenticates through the mock ` +
        'phone verifier, which is a development-only bypass.',
    );
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      ...rest.headers,
    },
  });
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  }
  return body as T;
}

/** Registers the account if it does not exist, then signs in. Returns the access token. */
async function ensureAccount(account: typeof CLIENT): Promise<string> {
  try {
    await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...account,
        password: PASSWORD,
        countryCode: COUNTRY_CODE,
        firebaseIdToken: `${MOCK_TOKEN_PREFIX}${account.phone}`,
      }),
    });
    console.log(`  created ${account.role} ${account.phone}`);
  } catch (err) {
    // A 409 means it already exists, which is the normal case on every run
    // after the first. Anything else is a real failure and should surface.
    if (!/409/.test((err as Error).message)) throw err;
    console.log(`  reusing ${account.role} ${account.phone}`);
  }

  const session = await call<{ accessToken: string }>('/auth/login/otp', {
    method: 'POST',
    body: JSON.stringify({
      phone: account.phone,
      firebaseIdToken: `${MOCK_TOKEN_PREFIX}${account.phone}`,
    }),
  });
  return session.accessToken;
}

interface NearbyOrder {
  id: string;
  minPriceSuggested?: number;
  min_price_suggested?: number;
}

/** Polls until a published order is within reach, then returns it. */
async function waitForOrder(token: string): Promise<NearbyOrder> {
  const [lat, lng] = ROUTE[0]!;
  for (;;) {
    const orders = await call<NearbyOrder[]>(`/orders/nearby?lat=${lat}&lng=${lng}&radiusKm=50`, {
      token,
    });
    if (orders.length > 0) return orders[0]!;
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
}

/** Polls the driver's deliveries until this order's offer has been accepted. */
async function waitForAcceptance(token: string, orderId: string): Promise<{ id: string }> {
  for (;;) {
    const deliveries = await call<Array<{ id: string; orderId: string }>>('/deliveries', { token });
    const mine = deliveries.find((d) => d.orderId === orderId);
    if (mine !== undefined) return mine;
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
}

function connectSocket(token: string): Socket {
  const socket = io(BASE_URL, { transports: ['websocket'], auth: { token } });
  socket.on('connect_error', (err) => console.error('  socket error:', err.message));
  return socket;
}

/** Interpolates `steps` positions between two route points. */
function* walk(steps: number): Generator<{ lat: number; lng: number }> {
  for (let i = 0; i < ROUTE.length - 1; i += 1) {
    const [fromLat, fromLng] = ROUTE[i]!;
    const [toLat, toLng] = ROUTE[i + 1]!;
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      yield { lat: fromLat + (toLat - fromLat) * t, lng: fromLng + (toLng - fromLng) * t };
    }
  }
  const [lat, lng] = ROUTE[ROUTE.length - 1]!;
  yield { lat, lng };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  assertLocal(BASE_URL);
  console.log(`Kaya simulated driver -> ${API}\n`);

  console.log('Accounts:');
  const clientToken = await ensureAccount(CLIENT);
  const driverToken = await ensureAccount(DRIVER);
  void clientToken;

  console.log(`\nSign into the app as ${CLIENT.phone}, then create an order.`);
  process.stdout.write('Waiting for a published order');

  const order = await waitForOrder(driverToken);
  console.log(`\n  found order ${order.id}`);

  const suggested = Number(order.minPriceSuggested ?? order.min_price_suggested ?? 20);
  const proposedPrice = Math.round(suggested * 1.1 * 100) / 100;
  await call(`/orders/${order.id}/offers`, {
    method: 'POST',
    token: driverToken,
    body: JSON.stringify({ proposedPrice }),
  });
  console.log(`  offered ${proposedPrice}`);

  process.stdout.write('Waiting for the client to accept');
  const delivery = await waitForAcceptance(driverToken, order.id);
  console.log(`\n  accepted -> delivery ${delivery.id}`);

  const socket = connectSocket(driverToken);
  await call(`/deliveries/${delivery.id}/start`, { method: 'POST', token: driverToken });
  console.log('  started (en route)');

  // Positions and state changes are interleaved so the client sees the marker
  // move *between* transitions, which is what the tracking screen is for.
  const positions = walk(4);
  let ticks = 0;
  for (const position of positions) {
    socket.emit('location:update', position);
    ticks += 1;

    if (ticks === 6) {
      await call(`/deliveries/${delivery.id}/pickup`, {
        method: 'POST',
        token: driverToken,
        body: JSON.stringify({}),
      });
      console.log('  picked up');
    }
    if (ticks === 10) {
      await call(`/deliveries/${delivery.id}/transit`, { method: 'POST', token: driverToken });
      console.log('  in transit');
    }

    await sleep(POSITION_INTERVAL_MS);
  }

  await call(`/deliveries/${delivery.id}/confirm-delivery`, {
    method: 'POST',
    token: driverToken,
    body: JSON.stringify({}),
  });
  console.log('  delivered');

  socket.disconnect();
}

main().catch((err: unknown) => {
  console.error(`\n${(err as Error).message}`);
  process.exitCode = 1;
});
