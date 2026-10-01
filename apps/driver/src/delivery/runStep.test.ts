import { ORDER_STATUSES } from "@kaya/core";
import { runStepFor } from "./runStep";

describe("runStepFor", () => {
  it("walks the four steps in the order the backend transitions them", () => {
    expect(runStepFor("accepted").action).toBe("start");
    expect(runStepFor("driver_en_route").action).toBe("pickup");
    expect(runStepFor("picked_up").action).toBe("transit");
    expect(runStepFor("in_transit").action).toBe("deliver");
  });

  it("advances the timeline index alongside the action", () => {
    expect(runStepFor("accepted").index).toBe(0);
    expect(runStepFor("driver_en_route").index).toBe(1);
    expect(runStepFor("picked_up").index).toBe(2);
    expect(runStepFor("in_transit").index).toBe(3);
  });

  it("lets a run begin from offers_received, which a lagging order can still be in", () => {
    // A delivery exists only because an offer was accepted; refusing to start
    // because the order row has not caught up strands the driver on a screen
    // whose only button does nothing.
    expect(runStepFor("offers_received").action).toBe("start");
  });

  it("offers nothing once the run is over or was called off", () => {
    for (const status of ["delivered", "cancelled", "disputed"] as const) {
      expect(runStepFor(status).action).toBe("done");
    }
  });

  it("offers nothing for an unknown or absent status", () => {
    // The live socket channel carries delivery vocabulary too. Anything this
    // does not recognise must not become a transition the backend rejects.
    expect(runStepFor(undefined).action).toBe("done");
    expect(runStepFor("in_progress" as never).action).toBe("done");
  });

  it("answers for every OrderStatus the wire can produce", () => {
    // A status added to the enum without a case here would silently fall into
    // "done" and freeze a real run; this is the reminder to look.
    for (const status of ORDER_STATUSES) {
      expect(runStepFor(status).labelKey).toEqual(expect.any(String));
    }
  });
});
