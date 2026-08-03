import type { AuthTokens } from "../models/auth";

/**
 * Persistence boundary for the JWT pair. The interceptor depends on this
 * interface, never on a concrete store, so tests swap an in-memory one and the
 * platform keychain implementation can live in @kaya/ui without dragging a
 * native module into this package.
 */
export interface TokenStore {
  readAccess(): Promise<string | null>;
  readRefresh(): Promise<string | null>;
  save(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory store for tests, previews and the SKIP_AUTH dev path. */
export class InMemoryTokenStore implements TokenStore {
  private access: string | null = null;
  private refresh: string | null = null;

  async readAccess(): Promise<string | null> {
    return this.access;
  }

  async readRefresh(): Promise<string | null> {
    return this.refresh;
  }

  async save(tokens: AuthTokens): Promise<void> {
    this.access = tokens.accessToken;
    this.refresh = tokens.refreshToken;
  }

  async clear(): Promise<void> {
    this.access = null;
    this.refresh = null;
  }
}
