import { z } from "zod";
import {
  boolLike,
  dateLike,
  decimalLike,
  decimalLikeOrNull,
  intLike,
  jsonMap,
  stringLikeOrNull,
} from "./coerce";
import { orderStatus, userRole, vehicleType } from "./enums";

describe("decimalLike", () => {
  it("accepts the strings Prisma Decimal serialises to", () => {
    expect(decimalLike().parse("50.00")).toBe(50);
    expect(decimalLike().parse(50)).toBe(50);
  });

  it("falls back on null, undefined and garbage", () => {
    expect(decimalLike().parse(null)).toBe(0);
    expect(decimalLike().parse(undefined)).toBe(0);
    expect(decimalLike().parse("abc")).toBe(0);
    expect(decimalLike(5).parse(null)).toBe(5);
  });

  it("keeps null distinguishable when the field is optional", () => {
    expect(decimalLikeOrNull().parse(null)).toBeNull();
    expect(decimalLikeOrNull().parse("2.5")).toBe(2.5);
  });
});

describe("intLike and boolLike", () => {
  it("coerces numeric strings and floats to int", () => {
    expect(intLike().parse("7")).toBe(7);
    expect(intLike().parse(7.9)).toBe(7);
    expect(intLike(5).parse(null)).toBe(5);
  });

  it("coerces truthy wire shapes to bool", () => {
    expect(boolLike().parse(true)).toBe(true);
    expect(boolLike().parse("true")).toBe(true);
    expect(boolLike().parse("TRUE")).toBe(true);
    expect(boolLike().parse(1)).toBe(true);
    expect(boolLike().parse(0)).toBe(false);
    expect(boolLike(true).parse(null)).toBe(true);
  });
});

describe("dateLike", () => {
  it("parses ISO strings", () => {
    expect(dateLike().parse("2026-08-02T10:00:00.000Z").toISOString()).toBe(
      "2026-08-02T10:00:00.000Z",
    );
  });

  it("returns null for absent optional dates", () => {
    expect(stringLikeOrNull().parse(null)).toBeNull();
  });
});

describe("jsonMap", () => {
  it("returns an object or an empty one", () => {
    expect(jsonMap().parse({ a: 1 })).toEqual({ a: 1 });
    expect(jsonMap().parse(null)).toEqual({});
    expect(jsonMap().parse("nope")).toEqual({});
  });
});

describe("wire enums", () => {
  it("passes known snake_case values through", () => {
    expect(orderStatus.parse("offers_received")).toBe("offers_received");
    expect(userRole.parse("livreur")).toBe("livreur");
  });

  it("falls back on unknown values instead of throwing", () => {
    expect(orderStatus.parse("teleported")).toBe("draft");
    expect(userRole.parse(undefined)).toBe("client");
  });

  it("leaves genuinely optional enums null", () => {
    expect(vehicleType.parse(null)).toBeNull();
    expect(vehicleType.parse("moto")).toBe("moto");
  });

  it("is assignable to the exported union type", () => {
    const s: z.infer<typeof orderStatus> = "delivered";
    expect(s).toBe("delivered");
  });
});
