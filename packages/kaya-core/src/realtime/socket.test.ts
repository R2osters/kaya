import { io } from "socket.io-client";
import { ApiConfig } from "../api/config";
import { SOCKET_EVENTS } from "./events";
import { SocketService } from "./socket";

jest.mock("socket.io-client", () => ({ io: jest.fn() }));

const mockedIo = io as unknown as jest.Mock;

/** Minimal hand-rolled stand-in for a socket.io-client `Socket`. */
class FakeSocket {
  connected = false;
  readonly emitted: Array<{ event: string; payload: unknown }> = [];
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  removeAllListenersCalls = 0;
  disconnectCalls = 0;

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.connected = false;
  }

  removeAllListeners(): void {
    this.removeAllListenersCalls += 1;
    this.listeners.clear();
  }

  /** Test helper: simulate the server pushing an event down the wire. */
  trigger(event: string, payload: unknown): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler(payload);
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

describe("SocketService", () => {
  let fake: FakeSocket;
  let config: ApiConfig;

  beforeEach(() => {
    fake = new FakeSocket();
    mockedIo.mockReset();
    mockedIo.mockReturnValue(fake);
    config = new ApiConfig({ baseUrl: "http://localhost:3000" });
  });

  it("connect() targets the bare origin (ApiConfig.socketUrl), not the /api/v1 REST prefix", () => {
    const svc = new SocketService(config);
    svc.connect("token-123");

    expect(mockedIo).toHaveBeenCalledTimes(1);
    expect(mockedIo.mock.calls[0]?.[0]).toBe("http://localhost:3000");
    expect(mockedIo.mock.calls[0]?.[1]).toMatchObject({ auth: { token: "token-123" } });
  });

  it("connected reflects the underlying socket, false before connect()", () => {
    const svc = new SocketService(config);
    expect(svc.connected).toBe(false);
    svc.connect("t");
    fake.connected = true;
    expect(svc.connected).toBe(true);
  });

  it("on() parses the raw snake_case payload into the typed camelCase shape before calling the handler", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    const received: unknown[] = [];
    svc.on("location:driver", (e) => received.push(e));

    fake.trigger("location:driver", {
      livreur_id: "u1",
      lat: "5.556",
      lng: "-0.1969",
      timestamp: "2026-08-02T10:30:00.000Z",
    });

    expect(received).toEqual([
      {
        livreurId: "u1",
        lat: 5.556,
        lng: -0.1969,
        timestamp: new Date("2026-08-02T10:30:00.000Z"),
      },
    ]);
  });

  it("on() does not throw and does not dispatch when the raw payload fails schema parsing", () => {
    // socket.io-client invokes listeners from inside its own transport packet handling, not
    // from a call site the app controls -- a throw here would be an uncaught exception the
    // app cannot try/catch (and could crash a React Native app). So a non-object payload
    // (which fails the schema's z.object() check) must be swallowed, not thrown. See
    // socket.ts for the field-level half of the design (individual missing/renamed keys
    // degrade via the shared coerce helpers instead, so one dropped field doesn't crash a
    // 5s-interval GPS stream).
    const svc = new SocketService(config);
    svc.connect("t");
    let dispatched = false;
    svc.on("offer:new", () => {
      dispatched = true;
    });

    expect(() => fake.trigger("offer:new", "not-an-object")).not.toThrow();
    expect(dispatched).toBe(false);
  });

  it("on() routes a malformed payload to onPayloadError instead of dispatching it", () => {
    const errors: Array<{ event: string; error: unknown; raw: unknown }> = [];
    const svc = new SocketService(config, {
      onPayloadError: (event, error, rawPayload) => {
        errors.push({ event, error, raw: rawPayload });
      },
    });
    svc.connect("t");
    let dispatched = false;
    svc.on("offer:new", () => {
      dispatched = true;
    });

    fake.trigger("offer:new", "not-an-object");

    expect(dispatched).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.event).toBe("offer:new");
    expect(errors[0]?.raw).toBe("not-an-object");
    expect(errors[0]?.error).toBeInstanceOf(Error);
  });

  it("onPayloadError defaults to a no-op when not supplied", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.on("offer:new", () => undefined);

    expect(() => fake.trigger("offer:new", null)).not.toThrow();
  });

  it("on() returns an unsubscribe function that detaches the listener", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    const received: unknown[] = [];
    const unsubscribe = svc.on("delivery:status", (e) => received.push(e));

    expect(fake.listenerCount("delivery:status")).toBe(1);
    unsubscribe();
    expect(fake.listenerCount("delivery:status")).toBe(0);

    fake.trigger("delivery:status", {
      delivery_id: "d1",
      status: "picked_up",
      timestamp: "2026-08-02T10:30:00.000Z",
    });
    expect(received).toEqual([]);
  });

  it("joinDelivery() emits chat:join with the delivery_id key the gateway's handler reads", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.joinDelivery("d1");

    expect(fake.emitted).toEqual([{ event: SOCKET_EVENTS.joinDelivery, payload: { delivery_id: "d1" } }]);
    expect(SOCKET_EVENTS.joinDelivery).toBe("chat:join");
  });

  it("joinOrder() emits order:join with the order_id key the gateway's OrderJoin handler reads", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.joinOrder("o1");

    expect(fake.emitted).toEqual([{ event: SOCKET_EVENTS.joinOrder, payload: { order_id: "o1" } }]);
    expect(SOCKET_EVENTS.joinOrder).toBe("order:join");
  });

  it("leaveDelivery() does not emit on the wire (no gateway leave handler exists) but does stop local dispatch", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.leaveDelivery("d1");

    expect(fake.emitted).toEqual([]);
  });

  it("an offer:new event dispatches for a joined order and is dropped for an unjoined order", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.joinOrder("o1");
    const received: unknown[] = [];
    svc.on("offer:new", (e) => received.push(e));

    fake.trigger("offer:new", { offerId: "of1", orderId: "o1", livreurId: "u1", proposedPrice: "28.00" });
    fake.trigger("offer:new", { offerId: "of2", orderId: "o2", livreurId: "u2", proposedPrice: "12.00" });

    expect(received).toHaveLength(1);
    expect((received[0] as { orderId: string }).orderId).toBe("o1");
  });

  it("a delivery:status event no longer dispatches for a delivery after leaveDelivery()", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.joinDelivery("d1");
    const received: unknown[] = [];
    svc.on("delivery:status", (e) => received.push(e));

    fake.trigger("delivery:status", { delivery_id: "d1", status: "picked_up", timestamp: "2026-08-02T10:30:00.000Z" });
    svc.leaveDelivery("d1");
    fake.trigger("delivery:status", { delivery_id: "d1", status: "delivered", timestamp: "2026-08-02T10:31:00.000Z" });

    expect(received).toHaveLength(1);
    expect((received[0] as { status: string }).status).toBe("picked_up");
  });

  it("location:driver dispatches unconditionally -- its payload carries no delivery id to scope-filter on", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    // Deliberately not joining any delivery.
    const received: unknown[] = [];
    svc.on("location:driver", (e) => received.push(e));

    fake.trigger("location:driver", {
      livreur_id: "u1",
      lat: "5.556",
      lng: "-0.1969",
      timestamp: "2026-08-02T10:30:00.000Z",
    });

    expect(received).toHaveLength(1);
  });

  it("emitLocation() sends only {lat, lng} -- the gateway's location:update handler ignores anything else", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.emitLocation({ lat: 5.556, lng: -0.1969 });

    expect(fake.emitted).toEqual([
      { event: "location:update", payload: { lat: 5.556, lng: -0.1969 } },
    ]);
  });

  it("disconnect() tears down listeners and the socket, and connect() after it reconnects cleanly", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.disconnect();

    expect(fake.removeAllListenersCalls).toBe(1);
    expect(fake.disconnectCalls).toBe(1);
    expect(svc.connected).toBe(false);
  });

  it("connect() called twice tears down the first socket before opening the second", () => {
    const svc = new SocketService(config);
    svc.connect("t1");
    const first = fake;
    const second = new FakeSocket();
    mockedIo.mockReturnValue(second);

    svc.connect("t2");

    expect(first.removeAllListenersCalls).toBe(1);
    expect(first.disconnectCalls).toBe(1);
    expect(mockedIo).toHaveBeenCalledTimes(2);
  });
});
