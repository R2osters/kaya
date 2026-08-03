/**
 * Runtime API configuration. The base URL comes from the app's env config, so
 * no host is baked into the binary.
 */
export class ApiConfig {
  /** Origin only, e.g. http://localhost:3000 — no trailing slash, no prefix. */
  readonly baseUrl: string;
  /** Versioned REST prefix appended to the origin for REST calls. */
  readonly apiPrefix: string;

  constructor(input: { baseUrl: string; apiPrefix?: string }) {
    this.baseUrl = input.baseUrl.replace(/\/+$/, "");
    this.apiPrefix = input.apiPrefix ?? "/api/v1";
  }

  get restBaseUrl(): string {
    return `${this.baseUrl}${this.apiPrefix}`;
  }

  /** Socket.io connects to the origin; the gateway handles the namespace. */
  get socketUrl(): string {
    return this.baseUrl;
  }
}
