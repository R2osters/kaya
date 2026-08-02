import { authResultSchema, authTokensSchema, parseSocialLoginOutcome } from "./auth";

describe("authTokensSchema", () => {
  it("accepts camelCase keys", () => {
    const t = authTokensSchema.parse({ accessToken: "a", refreshToken: "r" });
    expect(t).toEqual({ accessToken: "a", refreshToken: "r" });
  });

  it("accepts snake_case keys as a fallback", () => {
    const t = authTokensSchema.parse({ access_token: "a", refresh_token: "r" });
    expect(t).toEqual({ accessToken: "a", refreshToken: "r" });
  });
});

describe("authResultSchema", () => {
  it("parses tokens with an embedded user", () => {
    const r = authResultSchema.parse({
      accessToken: "a",
      refreshToken: "r",
      user: { id: "u1", fullName: "Ama", role: "client" },
    });
    expect(r.tokens.accessToken).toBe("a");
    expect(r.user?.fullName).toBe("Ama");
  });

  it("leaves user null when absent", () => {
    expect(authResultSchema.parse({ accessToken: "a", refreshToken: "r" }).user).toBeNull();
  });
});

describe("parseSocialLoginOutcome", () => {
  it("routes a brand new email into the registration wizard", () => {
    const out = parseSocialLoginOutcome({
      isNewAccount: true,
      socialDraftToken: "tok",
      email: "new@example.com",
      fullName: "New User",
    });
    expect(out.kind).toBe("signup_required");
    if (out.kind === "signup_required") {
      expect(out.socialDraftToken).toBe("tok");
      expect(out.email).toBe("new@example.com");
      expect(out.fullName).toBe("New User");
    }
  });

  it("logs an existing account straight in", () => {
    const out = parseSocialLoginOutcome({ accessToken: "a", refreshToken: "r" });
    expect(out.kind).toBe("success");
    if (out.kind === "success") {
      expect(out.result.tokens.refreshToken).toBe("r");
    }
  });
});
