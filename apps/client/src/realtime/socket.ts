import { SocketService } from "@kaya/core";
import { apiConfig } from "../api/client";

/**
 * Singleton socket, built on the same ApiConfig the REST client uses so the
 * two can never drift onto different hosts. `SocketService` targets the bare
 * origin (`ApiConfig.socketUrl`) rather than `/api/v1` -- the gateway is not
 * mounted under the REST prefix.
 *
 * A payload that fails schema parsing is reported here rather than thrown.
 * socket.io invokes listeners from inside its own transport handling, so a
 * throw would be an uncaught exception the app cannot catch, which in React
 * Native can take the whole app down over one malformed packet. Warning is the
 * right level: it means the gateway's contract has drifted from @kaya/core's
 * schemas, which is a bug to fix but not a reason to stop the app.
 */
export const socketService = new SocketService(apiConfig, {
  onPayloadError: (event, error) => {
    console.warn(`[realtime] dropped a malformed "${event}" payload`, error);
  },
});
