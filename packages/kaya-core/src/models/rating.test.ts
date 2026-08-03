import { ratingSchema, ratingSummarySchema } from "./rating";

const RATING = {
  id: "r1",
  deliveryId: "d1",
  fromUserId: "u1",
  toUserId: "u2",
  score: "5",
  comment: "Fast and polite.",
  createdAt: "2026-08-02T11:00:00.000Z",
};

describe("ratingSchema", () => {
  it("coerces a score sent as a string", () => {
    const r = ratingSchema.parse(RATING);
    expect(r.score).toBe(5);
    expect(r.comment).toBe("Fast and polite.");
  });

  it("leaves an absent comment null", () => {
    expect(ratingSchema.parse({ id: "r2" }).comment).toBeNull();
  });
});

describe("ratingSummarySchema", () => {
  it("parses the average, count and list", () => {
    const s = ratingSummarySchema.parse({
      average: "4.80",
      count: "12",
      ratings: [RATING],
    });
    expect(s.average).toBe(4.8);
    expect(s.count).toBe(12);
    expect(s.ratings).toHaveLength(1);
    expect(s.ratings[0]?.score).toBe(5);
  });

  it("drops non-object entries instead of rejecting the whole summary", () => {
    // Dart's whereType<Map>() silently skipped these; parsing one would throw
    // out of the transform and blank the profile screen.
    const parse = () =>
      ratingSummarySchema.parse({
        average: 4.5,
        count: 2,
        ratings: [RATING, null, "oops", 42, [], new Date()],
      });
    expect(parse).not.toThrow();
    expect(parse().ratings).toHaveLength(1);
  });

  it("treats a missing or non-array ratings field as empty", () => {
    expect(ratingSummarySchema.parse({ average: 0, count: 0 }).ratings).toEqual([]);
    expect(
      ratingSummarySchema.parse({ average: 0, count: 0, ratings: "nope" }).ratings,
    ).toEqual([]);
  });
});
