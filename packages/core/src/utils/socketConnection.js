const DEFAULT_SOCKET_PATH = "/socket.io/";

/**
 * Resolve the Socket.IO host/path pair for every Lorax surface.
 *
 * Keeping this in core prevents the website and JBrowse adapter from drifting
 * on same-origin development proxies, packaged `/api` mounts, and cross-origin
 * backends.
 */
export function resolveSocketConnection({
  apiBase = "/",
  isProd = false,
  origin = typeof window !== "undefined" ? window.location.origin : null,
} = {}) {
  if (!origin) {
    throw new Error("Socket origin is required outside a browser.");
  }

  const resolvedApiBase = new URL(apiBase || "/", origin);
  const isCrossOrigin = resolvedApiBase.origin !== origin;
  const apiPath = resolvedApiBase.pathname.replace(/\/+$/, "");
  const backendSocketPath = apiPath
    ? `${apiPath}${DEFAULT_SOCKET_PATH}`
    : DEFAULT_SOCKET_PATH;

  return {
    host: isCrossOrigin ? resolvedApiBase.origin : origin,
    path: isCrossOrigin || isProd ? backendSocketPath : DEFAULT_SOCKET_PATH,
    isCrossOrigin,
  };
}

/**
 * Send one Socket.IO request and settle from either its response event or ack.
 * The response listener is installed before emit, stale responses can be
 * filtered, and every exit path removes listeners and timers.
 */
export function requestSocketResponse({
  socket,
  requestEvent,
  responseEvent,
  payload,
  timeoutMs = 30_000,
  ackTimeoutMs = null,
  matchResponse = null,
  errorEvent = null,
  errorMessage = `Socket request ${requestEvent} failed.`,
  timeoutMessage = `Timed out waiting for ${responseEvent}.`,
  disconnectMessage = `Socket disconnected while waiting for ${responseEvent}.`,
} = {}) {
  if (!socket || typeof socket.emit !== "function") {
    return Promise.reject(new Error("Socket not available."));
  }
  if (!requestEvent || !responseEvent) {
    return Promise.reject(
      new Error("Socket request and response event names are required."),
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      socket.off?.(responseEvent, handleResponse);
      socket.off?.("disconnect", handleDisconnect);
      if (errorEvent) {
        socket.off?.(errorEvent, handleError);
      }
    };

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    const handleResponse = (response) => {
      if (
        typeof matchResponse === "function"
        && !matchResponse(response)
      ) {
        return;
      }
      settle(resolve, response);
    };

    const handleDisconnect = () => {
      settle(reject, new Error(disconnectMessage));
    };

    const handleError = (message) => {
      const error = new Error(message?.message ?? errorMessage);
      if (message?.code) {
        error.code = message.code;
      }
      settle(reject, error);
    };

    socket.on?.(responseEvent, handleResponse);
    socket.on?.("disconnect", handleDisconnect);
    if (errorEvent) {
      socket.on?.(errorEvent, handleError);
    }
    timeoutId = setTimeout(() => {
      settle(reject, new Error(timeoutMessage));
    }, timeoutMs);

    if (
      Number.isFinite(ackTimeoutMs)
      && ackTimeoutMs > 0
      && typeof socket.timeout === "function"
    ) {
      socket.timeout(ackTimeoutMs).emit(
        requestEvent,
        payload,
        (error, response) => {
          // Ack timeouts are non-terminal because older backends only emit the
          // legacy response event.
          if (!error && response !== undefined && response !== null) {
            handleResponse(response);
          }
        },
      );
      return;
    }

    socket.emit(requestEvent, payload);
  });
}
