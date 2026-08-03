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

  it("contains a throwing onPayloadError so it cannot crash the transport", () => {
    // socket.io dispatches from inside its own packet handling, so anything
    // that escapes this listener is an uncaught exception the app cannot wrap.
    const svc = new SocketService(config, {
      onPayloadError: () => {
        throw new Error("telemetry blew up");
      },
    });
    svc.connect("t");
    const received: unknown[] = [];
    svc.on("offer:new", (e) => received.push(e));

    expect(() => fake.trigger("offer:new", null)).not.toThrow();
    expect(received).toHaveLength(0);
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

  // --- Finding 2: chat:message dispatch (the gateway's real payload shape, snake_case, no receiverId/isRead) ---

  it("a chat:message event with the gateway's real payload shape dispatches for a joined delivery", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.joinDelivery("d1");
    const received: unknown[] = [];
    svc.on("chat:message", (e) => received.push(e));

    // Copied verbatim from events.gateway.ts's onMessage()/messages.service.ts's
    // send() emit -- id, delivery_id, sender_id, message_text, image_url,
    // created_at. No receiverId/isRead: the gateway never sends them.
    fake.trigger("chat:message", {
      id: "m1",
      delivery_id: "d1",
      sender_id: "u1",
      message_text: "on my way",
      image_url: null,
      created_at: "2026-08-02T10:30:00.000Z",
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      id: "m1",
      deliveryId: "d1",
      senderId: "u1",
      messageText: "on my way",
    });
  });

  it("a chat:message event is dropped for a delivery that was never joined", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    // Deliberately not joining d1.
    const received: unknown[] = [];
    svc.on("chat:message", (e) => received.push(e));

    fake.trigger("chat:message", {
      id: "m1",
      delivery_id: "d1",
      sender_id: "u1",
      message_text: "on my way",
      image_url: null,
      created_at: "2026-08-02T10:30:00.000Z",
    });

    expect(received).toHaveLength(0);
  });

  // --- Finding 3: reconnect replays room joins; on() survives a socket rebuilt by connect() ---

  it("replays joined delivery/order rooms every time the transport (re)connects, not just on the first handshake", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.joinDelivery("d1");
    svc.joinOrder("o1");
    fake.emitted.length = 0; // clear the joins already recorded above

    // Simulate socket.io-client re-emitting 'connect' after an automatic
    // reconnection (same Socket instance, no app-level connect() call).
    fake.trigger("connect", undefined);

    expect(fake.emitted).toEqual([
      { event: SOCKET_EVENTS.joinDelivery, payload: { delivery_id: "d1" } },
      { event: SOCKET_EVENTS.joinOrder, payload: { order_id: "o1" } },
    ]);
  });

  it("re-joins previously joined rooms after connect() rebuilds the socket for a token refresh", () => {
    // A driver mid-delivery whose 15-minute access token expires calls
    // connect() again. If the joined ids were dropped on the rebuild, the new
    // socket would report connected, fire onConnectionChange(true) and receive
    // nothing — with the local filter discarding whatever did arrive, so the
    // tracking screen would sit silently dead until it was remounted.
    const svc = new SocketService(config);
    svc.connect("t1");
    svc.joinDelivery("d1");
    svc.joinOrder("o1");

    const second = new FakeSocket();
    mockedIo.mockReturnValue(second);
    svc.connect("t2");
    second.trigger("connect", undefined);

    expect(second.emitted).toEqual([
      { event: SOCKET_EVENTS.joinDelivery, payload: { delivery_id: "d1" } },
      { event: SOCKET_EVENTS.joinOrder, payload: { order_id: "o1" } },
    ]);

    // And events for those rooms still reach handlers through the filter.
    const received: unknown[] = [];
    svc.on("delivery:status", (e) => received.push(e));
    second.trigger("delivery:status", {
      delivery_id: "d1",
      status: "picked_up",
      timestamp: "2026-08-03T10:30:00.000Z",
    });
    expect(received).toHaveLength(1);
  });

  it("forgets joined rooms after an explicit disconnect, unlike a token-refresh rebuild", () => {
    const svc = new SocketService(config);
    svc.connect("t1");
    svc.joinDelivery("d1");
    svc.disconnect();

    const second = new FakeSocket();
    mockedIo.mockReturnValue(second);
    svc.connect("t2");
    second.trigger("connect", undefined);

    expect(second.emitted).toEqual([]);
  });

  it("does not replay a room that was left before the reconnect", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.joinDelivery("d1");
    svc.leaveDelivery("d1");
    fake.emitted.length = 0;

    fake.trigger("connect", undefined);

    expect(fake.emitted).toEqual([]);
  });

  it("a handler registered via on() keeps receiving events after a later connect() rebuilds the socket (token refresh)", () => {
    const svc = new SocketService(config);
    svc.connect("t1");
    const received: unknown[] = [];
    svc.on("delivery:status", (e) => received.push(e));

    // Token refresh: connect() tears down the first socket and builds a
    // second one. A naive on() implementation that closed over the first
    // socket would silently stop dispatching here.
    const second = new FakeSocket();
    mockedIo.mockReturnValue(second);
    svc.connect("t2");
    svc.joinDelivery("d1");

    second.trigger("delivery:status", {
      delivery_id: "d1",
      status: "picked_up",
      timestamp: "2026-08-02T10:30:00.000Z",
    });

    expect(received).toHaveLength(1);
    expect((received[0] as { status: string }).status).toBe("picked_up");
  });

  it("unsubscribe resolves the current socket at call time, detaching from a rebuilt socket rather than a stale one", () => {
    const svc = new SocketService(config);
    svc.connect("t1");
    const unsubscribe = svc.on("delivery:status", () => undefined);

    const second = new FakeSocket();
    mockedIo.mockReturnValue(second);
    svc.connect("t2");

    expect(second.listenerCount("delivery:status")).toBe(1);
    unsubscribe();
    expect(second.listenerCount("delivery:status")).toBe(0);
  });

  // --- Finding 7: connection-state observable ---

  it("onConnectionChange reports true on (re)connect and false on disconnect/connect_error", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    const events: boolean[] = [];
    svc.onConnectionChange((connected) => events.push(connected));

    fake.trigger("connect", undefined);
    fake.trigger("disconnect", "transport close");
    fake.trigger("connect_error", new Error("boom"));

    expect(events).toEqual([true, false, false]);
  });

  it("onConnectionChange's unsubscribe stops further notifications", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    const events: boolean[] = [];
    const unsubscribe = svc.onConnectionChange((connected) => events.push(connected));

    fake.trigger("connect", undefined);
    unsubscribe();
    fake.trigger("disconnect", "transport close");

    expect(events).toEqual([true]);
  });

  it("disconnect() synchronously reports false even though it strips the socket's own 'disconnect' listener first", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    const events: boolean[] = [];
    svc.onConnectionChange((connected) => events.push(connected));

    svc.disconnect();

    expect(events).toEqual([false]);
  });

  it("a throwing onConnectionChange listener does not crash notification of the others", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    const events: boolean[] = [];
    svc.onConnectionChange(() => {
      throw new Error("boom");
    });
    svc.onConnectionChange((connected) => events.push(connected));

    expect(() => fake.trigger("connect", undefined)).not.toThrow();
    expect(events).toEqual([true]);
  });

  // --- Finding 7: socket-side sendMessage ---

  it("sendMessage() emits chat:message with delivery_id and only the fields supplied, for the gateway's onMessage() handler", () => {
    const svc = new SocketService(config);
    svc.connect("t");
    svc.sendMessage("d1", { text: "hello" });
    svc.sendMessage("d1", { imageUrl: "https://cdn.example/x.png" });
    svc.sendMessage("d1", { text: "hi", imageUrl: "https://cdn.example/y.png" });
    svc.sendMessage("d1");

    expect(fake.emitted).toEqual([
      { event: "chat:message", payload: { delivery_id: "d1", message_text: "hello" } },
      { event: "chat:message", payload: { delivery_id: "d1", image_url: "https://cdn.example/x.png" } },
      {
        event: "chat:message",
        payload: { delivery_id: "d1", message_text: "hi", image_url: "https://cdn.example/y.png" },
      },
      { event: "chat:message", payload: { delivery_id: "d1" } },
    ]);
  });
});
