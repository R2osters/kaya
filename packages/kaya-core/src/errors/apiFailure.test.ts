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

  it("classifies the other codes that mean the request never left", () => {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET"]) {
      expect(toApiFailure(new AxiosError("down", code)).kind).toBe("network");
    }
    expect(toApiFailure(new AxiosError("slow", "ETIMEDOUT")).kind).toBe("timeout");
  });

  it("leaves an unrecognised transport code unknown, not network", () => {
    // Telling someone to check their connection when the fault was elsewhere
    // sends them chasing a problem they cannot fix. The Dart original left
    // unclassified transport errors as unknown too.
    expect(toApiFailure(new AxiosError("weird", "ERR_BAD_OPTION_VALUE")).kind).toBe(
      "unknown",
    );
    expect(toApiFailure(new AxiosError("no code at all")).kind).toBe("unknown");
  });
});

describe("ApiFailure serialisation", () => {
  it("keeps the message when logged through JSON.stringify", () => {
    const f = new ApiFailure({
      kind: "conflict",
      message: "Offer already accepted",
      statusCode: 409,
    });
    expect(JSON.parse(JSON.stringify(f))).toEqual({
      name: "ApiFailure",
      kind: "conflict",
      message: "Offer already accepted",
      statusCode: 409,
      fieldErrors: null,
    });
  });
});
