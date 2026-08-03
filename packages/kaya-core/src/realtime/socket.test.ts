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

  it("on() throws out of the listener when the raw payload is not the object shape the gateway sends", () => {
    // A non-object payload fails the schema's z.object() check outright -- this is the
    // "surfaces as a legible error" half of the design; see socket.ts for the field-level
    // half (individual missing/renamed keys degrade via the shared coerce helpers, same as
    // the rest of the package, so one dropped field doesn't crash a 5s-interval GPS stream).
    const svc = new SocketService(config);
    svc.connect("t");
    svc.on("offer:new", () => {
      throw new Error("handler should not run");
    });

    expect(() => fake.trigger("offer:new", "not-an-object")).toThrow();
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

  it("leaveDelivery() is a documented no-op: the gateway has no leave handler to emit to", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.leaveDelivery("d1");

    expect(fake.emitted).toEqual([]);
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
