import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { toApiFailure } from "../errors/apiFailure";
import { type AuthTokens, authTokensSchema } from "../models/auth";
import type { TokenStore } from "../storage/tokenStore";
import type { ApiConfig } from "./config";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** Omit the bearer header and never attempt a refresh for this request. */
    skipAuth?: boolean;
    /** Set internally once a request has been replayed after a refresh. */
    retried?: boolean;
  }
}

/**
 * Builds the shared HTTP client: bearer header on every request, transparent
 * refresh on 401, and a single replay of the original request.
 *
 * Concurrent refreshes are coalesced into one in-flight promise. Without that,
 * two simultaneous 401s rotate the refresh token twice; the second rotation
 * revokes the first and the user is signed out at random.
 */
export function createHttpClient(opts: {
  config: ApiConfig;
  store: TokenStore;
  onSessionExpired: () => Promise<void> | void;
}): AxiosInstance {
  const { config, store, onSessionExpired } = opts;

  const client = axios.create({
    baseURL: config.restBaseUrl,
    timeout: 20_000,
    headers: { "Content-Type": "application/json" },
  });

  let inFlightRefresh: Promise<AuthTokens | null> | null = null;

  /**
   * Issued through `client` itself (marked `skipAuth`) rather than a separate
   * bare instance: a second axios instance would need its own adapter wired
   * up wherever `client`'s is (mocked or real), which only adds a place for
   * the two to drift apart. `skipAuth` already keeps the request interceptor
   * from attaching a token here, and a 401 on `/auth/refresh` is not
   * replayable (see `replayable` below, which requires `skipAuth !== true`),
   * so this cannot recurse into another refresh.
   */
  async function doRefresh(): Promise<AuthTokens | null> {
    const refreshToken = await store.readRefresh();
    if (refreshToken === null || refreshToken === "") return null;
    try {
      const res = await client.post(
        "/auth/refresh",
        { refreshToken },
        { skipAuth: true },
      );
      const tokens = authTokensSchema.parse(res.data);
      await store.save(tokens);
      return tokens;
    } catch {
      await store.clear();
      return null;
    }
  }

  function refreshTokens(): Promise<AuthTokens | null> {
    inFlightRefresh ??= doRefresh().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  }

  client.interceptors.request.use(async (req: InternalAxiosRequestConfig) => {
    if (req.skipAuth !== true) {
      const token = await store.readAccess();
      if (token !== null && token !== "") {
        req.headers.Authorization = `Bearer ${token}`;
      }
    }
    return req;
  });

  client.interceptors.response.use(
    (res) => res,
    async (error: unknown) => {
      const failure = toApiFailure(error);
      const req = axios.isAxiosError(error)
        ? (error.config as InternalAxiosRequestConfig | undefined)
        : undefined;

      const replayable =
        failure.kind === "unauthorized" &&
        req !== undefined &&
        req.skipAuth !== true &&
        req.retried !== true;

      if (!replayable) throw failure;

      const tokens = await refreshTokens();
      if (tokens === null) {
        // The caller's sign-out handler is not allowed to change what this
        // request rejects with. Whatever it throws, the screen still sees the
        // original unauthorized failure rather than a routing error.
        try {
          await onSessionExpired();
        } catch {
          // deliberately swallowed
        }
        throw failure;
      }

      req.retried = true;
      // Belt and braces: the request interceptor re-reads the store on the
      // replay and would normally set this header itself, but it leaves the
      // header untouched when the store hands back nothing. Setting it here
      // means the replay carries the token we just obtained either way.
      req.headers.Authorization = `Bearer ${tokens.accessToken}`;
      try {
        return await client.request(req);
      } catch (replayError) {
        throw toApiFailure(replayError);
      }
    },
  );

  return client;
}
