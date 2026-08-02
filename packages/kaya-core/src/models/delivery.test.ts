import { deliverySchema, timelineStep } from "./delivery";
import { isLive, isScheduled, orderSchema } from "./order";
import { offerSchema } from "./offer";

describe("orderSchema", () => {
  it("folds the flat lat/lng columns into geo points", () => {
    const o = orderSchema.parse({
      id: "o1",
      clientId: "c1",
      pickupAddress: "Oxford Street, Osu",
      pickupLat: "5.5560",
      pickupLng: "-0.1969",
      deliveryAddress: "14 Mango Lane, East Legon",
      deliveryLat: "5.6350",
      deliveryLng: "-0.1660",
      status: "published",
      minPriceSuggested: "24.00",
      distanceKm: "6.2",
      createdAt: "2026-08-02T10:00:00.000Z",
    });
    expect(o.pickup).toEqual({ lat: 5.556, lng: -0.1969 });
    expect(o.dropoff).toEqual({ lat: 5.635, lng: -0.166 });
    expect(o.minPriceSuggested).toBe(24);
    expect(isLive(o)).toBe(true);
    expect(isScheduled(o)).toBe(false);
  });

  it("marks an order with a scheduledTime as scheduled", () => {
    const o = orderSchema.parse({
      id: "o2",
      status: "draft",
      scheduledTime: "2026-08-03T08:00:00.000Z",
    });
    expect(isScheduled(o)).toBe(true);
    expect(isLive(o)).toBe(false);
  });
});

describe("offerSchema", () => {
  it("parses the embedded livreur relation when present", () => {
    const o = offerSchema.parse({
      id: "of1",
      orderId: "o1",
      livreurId: "u1",
      proposedPrice: "28.00",
      minPrice: "24.00",
      status: "pending",
      createdAt: "2026-08-02T10:05:00.000Z",
      livreur: { id: "u1", fullName: "Kwame Mensah", role: "livreur" },
    });
    expect(o.proposedPrice).toBe(28);
    expect(o.driver?.fullName).toBe("Kwame Mensah");
  });

  it("leaves driver null when the relation is absent", () => {
    const o = offerSchema.parse({ id: "of2", orderId: "o1", livreurId: "u2" });
    expect(o.driver).toBeNull();
    expect(o.status).toBe("pending");
  });

  it.each([
    ["an empty array", []],
    ["a populated array", [{ id: "u1", fullName: "Kwame Mensah", role: "livreur" }]],
    ["a Date", new Date("2026-08-02T10:00:00.000Z")],
    ["a string", "not-a-relation"],
    ["a number", 42],
  ])("degrades livreur to null without throwing when it is %s", (_label, livreur) => {
    expect(() =>
      offerSchema.parse({ id: "of3", orderId: "o1", livreurId: "u3", livreur }),
    ).not.toThrow();
    const o = offerSchema.parse({ id: "of3", orderId: "o1", livreurId: "u3", livreur });
    expect(o.driver).toBeNull();
  });
});

describe("timelineStep", () => {
  const base = {
    id: "d1",
    orderId: "o1",
    livreurId: "u1",
    status: "in_progress",
    clientPaymentStatus: "escrow_held",
    createdAt: "2026-08-02T10:00:00.000Z",
  };

  it("is 0 before pickup", () => {
    expect(timelineStep(deliverySchema.parse(base))).toBe(0);
  });

  it("is 1 once picked up", () => {
    const d = deliverySchema.parse({ ...base, pickupTime: "2026-08-02T10:20:00.000Z" });
    expect(timelineStep(d)).toBe(1);
  });

  it("is 2 once the embedded order says in_transit", () => {
    const d = deliverySchema.parse({
      ...base,
      pickupTime: "2026-08-02T10:20:00.000Z",
      order: { id: "o1", status: "in_transit" },
    });
    expect(timelineStep(d)).toBe(2);
  });

  it("is 3 once delivered or completed", () => {
    const byTime = deliverySchema.parse({
      ...base,
      deliveryTime: "2026-08-02T10:45:00.000Z",
    });
    const byStatus = deliverySchema.parse({ ...base, status: "completed" });
    expect(timelineStep(byTime)).toBe(3);
    expect(timelineStep(byStatus)).toBe(3);
  });

  it("defaults the litigation fee to 1", () => {
    expect(deliverySchema.parse(base).litigationFee).toBe(1);
  });

  it("parses the embedded order and livreur relations when present as plain objects", () => {
    const d = deliverySchema.parse({
      ...base,
      order: { id: "o1", status: "in_transit" },
      livreur: { id: "u1", fullName: "Kwame Mensah", role: "livreur" },
    });
    expect(d.order?.status).toBe("in_transit");
    expect(d.driver?.fullName).toBe("Kwame Mensah");
  });

  it.each([
    ["an empty array", []],
    ["a populated array", [{ id: "o1", status: "in_transit" }]],
    ["a Date", new Date("2026-08-02T10:00:00.000Z")],
    ["a string", "not-a-relation"],
    ["a number", 42],
  ])(
    "degrades order and livreur to null without throwing when they are %s",
    (_label, relation) => {
      expect(() =>
        deliverySchema.parse({ ...base, order: relation, livreur: relation }),
      ).not.toThrow();
      const d = deliverySchema.parse({ ...base, order: relation, livreur: relation });
      expect(d.order).toBeNull();
      expect(d.driver).toBeNull();
    },
  );
});
