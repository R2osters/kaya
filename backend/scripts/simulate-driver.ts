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

/**
 * An account whose token renews itself. Access tokens live 15 minutes and the
 * "waiting for the client to accept" poll can easily outlive that -- the first
 * long demo died on a 401 exactly there. Instead of tracking expiry, `call`
 * retries once through a fresh sign-in whenever the server says 401.
 */
class Session {
  private token = '';

  constructor(private readonly account: typeof CLIENT) {}

  /** Registers the account if it does not exist, then signs in. */
  async ensure(): Promise<void> {
    try {
      await call('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...this.account,
          password: PASSWORD,
          countryCode: COUNTRY_CODE,
          firebaseIdToken: `${MOCK_TOKEN_PREFIX}${this.account.phone}`,
        }),
      });
      console.log(`  created ${this.account.role} ${this.account.phone}`);
    } catch (err) {
      // A 409 means it already exists, which is the normal case on every run
      // after the first. Anything else is a real failure and should surface.
      if (!/409/.test((err as Error).message)) throw err;
      console.log(`  reusing ${this.account.role} ${this.account.phone}`);
    }
    await this.signIn();
  }

  private async signIn(): Promise<void> {
    const session = await call<{ accessToken: string }>('/auth/login/otp', {
      method: 'POST',
      body: JSON.stringify({
        phone: this.account.phone,
        firebaseIdToken: `${MOCK_TOKEN_PREFIX}${this.account.phone}`,
      }),
    });
    this.token = session.accessToken;
  }

  async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    // The backend gets rebuilt and restarted under this script all the time in
    // dev; a poll that lands in the restart window should ride it out, not
    // kill a demo twenty minutes in. Five 3-second retries cover a NestJS
    // boot; anything longer is a real outage worth crashing over.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await call<T>(path, { ...init, token: this.token });
      } catch (err) {
        const message = (err as Error).message;
        if (/-> 401/.test(message)) {
          await this.signIn();
          return call<T>(path, { ...init, token: this.token });
        }
        const network = /fetch failed|ECONNREFUSED|ECONNRESET|socket hang up/i.test(message);
        if (!network || attempt >= 5) throw err;
        process.stdout.write('!');
        await sleep(3_000);
      }
    }
  }

  /** The current raw token, for the socket handshake. */
  get accessToken(): string {
    return this.token;
  }
}

interface NearbyOrder {
  id: string;
  minPriceSuggested?: number;
  min_price_suggested?: number;
}

/** Polls until a published order is within reach, then returns it. */
async function waitForOrder(driver: Session): Promise<NearbyOrder> {
  const [lat, lng] = ROUTE[0]!;
  for (;;) {
    const orders = await driver.call<NearbyOrder[]>(
      `/orders/nearby?lat=${lat}&lng=${lng}&radiusKm=50`,
    );
    if (orders.length > 0) return orders[0]!;
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
}

/** Polls the driver's deliveries until this order's offer has been accepted. */
async function waitForAcceptance(driver: Session, orderId: string): Promise<{ id: string }> {
  for (;;) {
    const deliveries = await driver.call<Array<{ id: string; orderId: string }>>('/deliveries');
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
  const client = new Session(CLIENT);
  await client.ensure();
  const driver = new Session(DRIVER);
  await driver.ensure();

  // Nothing bids while offline: OffersService refuses, and the flag defaults
  // to false. Running this script on a clean seed is what surfaced that no
  // endpoint anywhere set it -- POST /driver/status exists because of that.
  await driver.call('/driver/status', {
    method: 'POST',
    body: JSON.stringify({ online: true }),
  });
  console.log('  driver online');

  // An accepted order leaves /orders/nearby, so a restarted script would poll
  // there forever while its delivery sat accepted-but-never-started. Resuming
  // is the difference between "restart the demo" and "re-seed the database"
  // after any mid-demo crash or restart.
  const standing =
    await driver.call<
      Array<{ id: string; status: string; startTime: string | null; deliveryTime: string | null }>
    >('/deliveries');
  const resumable = standing.find(
    (d) => d.startTime === null && d.deliveryTime === null && d.status !== 'cancelled',
  );
  if (resumable !== undefined) {
    console.log(`  resuming accepted delivery ${resumable.id}`);
    await runDelivery(driver, resumable.id);
    return;
  }

  console.log(`\nSign into the app as ${CLIENT.phone}, then create an order.`);
  process.stdout.write('Waiting for a published order');

  const order = await waitForOrder(driver);
  console.log(`\n  found order ${order.id}`);

  const suggested = Number(order.minPriceSuggested ?? order.min_price_suggested ?? 20);
  const proposedPrice = Math.round(suggested * 1.1 * 100) / 100;
  try {
    await driver.call(`/orders/${order.id}/offers`, {
      method: 'POST',
      body: JSON.stringify({ proposedPrice }),
    });
    console.log(`  offered ${proposedPrice}`);
  } catch (err) {
    // A previous run of this script already bid on this order; the offer is
    // still standing server-side, so resume waiting instead of dying. That is
    // exactly what happens when the script is restarted after a token-expiry
    // crash mid-demo.
    if (!/409/.test((err as Error).message)) throw err;
    console.log('  offer already standing, resuming');
  }

  process.stdout.write('Waiting for the client to accept');
  const delivery = await waitForAcceptance(driver, order.id);
  console.log(`\n  accepted -> delivery ${delivery.id}`);

  await runDelivery(driver, delivery.id);
}

/** Polls until the client's payment is held in escrow -- /start refuses before. */
async function waitForEscrow(driver: Session, deliveryId: string): Promise<void> {
  process.stdout.write('Waiting for the client to pay (escrow)');
  for (;;) {
    const deliveries =
      await driver.call<Array<{ id: string; clientPaymentStatus: string }>>('/deliveries');
    const mine = deliveries.find((d) => d.id === deliveryId);
    if (mine?.clientPaymentStatus === 'escrow_held') {
      console.log('\n  escrow held');
      return;
    }
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
}

/** Start-to-delivered: the whole course, positions interleaved with states. */
async function runDelivery(driver: Session, deliveryId: string): Promise<void> {
  await waitForEscrow(driver, deliveryId);
  const socket = connectSocket(driver.accessToken);
  await driver.call(`/deliveries/${deliveryId}/start`, { method: 'POST' });
  console.log('  started (en route)');

  // Positions and state changes are interleaved so the client sees the marker
  // move *between* transitions, which is what the tracking screen is for.
  const positions = walk(4);
  let ticks = 0;
  for (const position of positions) {
    socket.emit('location:update', position);
    ticks += 1;

    if (ticks === 6) {
      await driver.call(`/deliveries/${deliveryId}/pickup`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      console.log('  picked up');
    }
    if (ticks === 10) {
      await driver.call(`/deliveries/${deliveryId}/transit`, { method: 'POST' });
      console.log('  in transit');
    }

    await sleep(POSITION_INTERVAL_MS);
  }

  await driver.call(`/deliveries/${deliveryId}/confirm-delivery`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  console.log('  delivered');

  socket.disconnect();
}

main().catch((err: unknown) => {
  console.error(`\n${(err as Error).message}`);
  process.exitCode = 1;
});
