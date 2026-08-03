import { isAxiosError } from "axios";

/**
 * Typed failure surfaced to the UI. Screens react on `kind` rather than status
 * codes, so an unauthorized failure can trigger a re-login prompt without every
 * caller knowing about HTTP.
 */
export type FailureKind =
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "validation"
  | "server"
  | "cancelled"
  | "unknown";

export class ApiFailure extends Error {
  readonly kind: FailureKind;
  readonly statusCode: number | null;
  /** Field-level messages from class-validator (`{ field: [msgs] }`). */
  readonly fieldErrors: Record<string, string[]> | null;

  constructor(input: {
    kind: FailureKind;
    message: string;
    statusCode?: number | null;
    fieldErrors?: Record<string, string[]> | null;
  }) {
    super(input.message);
    this.name = "ApiFailure";
    this.kind = input.kind;
    this.statusCode = input.statusCode ?? null;
    this.fieldErrors = input.fieldErrors ?? null;
  }

  get isAuth(): boolean {
    return this.kind === "unauthorized";
  }
}

const DEFAULT_MESSAGES: Record<FailureKind, string> = {
  network: "Unable to reach the server. Are you online?",
  timeout: "The request timed out. Check your connection and retry.",
  unauthorized: "Your session has expired. Please sign in again.",
  forbidden: "You are not allowed to do that.",
  notFound: "Not found.",
  conflict: "That action conflicts with the current state.",
  validation: "Please check the information you entered.",
  server: "Something went wrong on our side. Try again shortly.",
  cancelled: "Request cancelled.",
  unknown: "Something went wrong.",
};

function kindForStatus(status: number): FailureKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

function extractMessage(data: unknown): string | null {
  if (data === null || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (Array.isArray(record.message) && record.message.length > 0) {
    return String(record.message[0]);
  }
  if (typeof record.error === "string") return record.error;
  return null;
}

/** NestJS class-validator returns `message` as a flat array of strings. */
function extractFieldErrors(data: unknown): Record<string, string[]> | null {
  if (data === null || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.message)) {
    return { _: record.message.map(String) };
  }
  return null;
}

export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiFailure) return error;

  if (!isAxiosError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return new ApiFailure({ kind: "unknown", message });
  }

  if (error.response) {
    const status = error.response.status;
    const kind = kindForStatus(status);
    return new ApiFailure({
      kind,
      statusCode: status,
      message: extractMessage(error.response.data) ?? DEFAULT_MESSAGES[kind],
      fieldErrors: extractFieldErrors(error.response.data),
    });
  }

  const kind: FailureKind =
    error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
      ? "timeout"
      : error.code === "ERR_CANCELED"
        ? "cancelled"
        : "network";

  return new ApiFailure({ kind, message: DEFAULT_MESSAGES[kind] });
}
