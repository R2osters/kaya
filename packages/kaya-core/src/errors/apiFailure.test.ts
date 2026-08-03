import { AxiosError, AxiosHeaders } from "axios";
import { ApiFailure, toApiFailure } from "./apiFailure";

const httpError = (status: number, data: unknown) => {
  const err = new AxiosError("Request failed");
  err.response = {
    status,
    statusText: "",
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return err;
};

describe("toApiFailure", () => {
  it("passes an ApiFailure through unchanged", () => {
    const f = new ApiFailure({ kind: "server", message: "boom" });
    expect(toApiFailure(f)).toBe(f);
  });

  it("maps status codes to kinds", () => {
    expect(toApiFailure(httpError(401, {})).kind).toBe("unauthorized");
    expect(toApiFailure(httpError(403, {})).kind).toBe("forbidden");
    expect(toApiFailure(httpError(404, {})).kind).toBe("notFound");
    expect(toApiFailure(httpError(409, {})).kind).toBe("conflict");
    expect(toApiFailure(httpError(400, {})).kind).toBe("validation");
    expect(toApiFailure(httpError(422, {})).kind).toBe("validation");
    expect(toApiFailure(httpError(503, {})).kind).toBe("server");
    expect(toApiFailure(httpError(418, {})).kind).toBe("unknown");
  });

  it("flags unauthorized via isAuth", () => {
    expect(toApiFailure(httpError(401, {})).isAuth).toBe(true);
    expect(toApiFailure(httpError(404, {})).isAuth).toBe(false);
  });

  it("prefers the server message over the default", () => {
    const f = toApiFailure(httpError(409, { message: "Offer already accepted" }));
    expect(f.message).toBe("Offer already accepted");
  });

  it("takes the first entry when class-validator returns an array", () => {
    const f = toApiFailure(
      httpError(400, { message: ["phone must be a valid phone number", "age must be an int"] }),
    );
    expect(f.message).toBe("phone must be a valid phone number");
    expect(f.fieldErrors).toEqual({
      _: ["phone must be a valid phone number", "age must be an int"],
    });
  });

  it("falls back to a default message per kind", () => {
    expect(toApiFailure(httpError(500, {})).message).toBe(
      "Something went wrong on our side. Try again shortly.",
    );
  });

  it("maps transport failures without a response", () => {
    const timeout = new AxiosError("timeout", "ECONNABORTED");
    expect(toApiFailure(timeout).kind).toBe("timeout");

    const offline = new AxiosError("Network Error", "ERR_NETWORK");
    expect(toApiFailure(offline).kind).toBe("network");

    const cancelled = new AxiosError("canceled", "ERR_CANCELED");
    expect(toApiFailure(cancelled).kind).toBe("cancelled");
  });

  it("wraps non-axios throwables", () => {
    const f = toApiFailure(new Error("kaboom"));
    expect(f.kind).toBe("unknown");
    expect(f.message).toBe("kaboom");
  });
});
