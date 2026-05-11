import { useRef, useState, useCallback, useEffect } from "react";
import { io } from "socket.io-client";
import websocketEvents from "../utils/websocketEvents.js";

export function useSocket({
  apiBase,
  isProd = false,
  diagnosticPingEnabled = false,
  onSessionError
}) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ message: null });

  const connect = useCallback(() => {
    if (socketRef.current) {
      return;
    }

    /**
     * Determine Socket.IO URL in a way that works for:
     * - Local dev (Vite): UI on :3001, backend on :8080, Vite proxies /socket.io
     * - Docker single-port: UI on :3000, nginx proxies /api/socket.io -> backend /socket.io
     * - pip single-port: UI on :3000, backend mounted under /api and Socket.IO at /api/socket.io
     * - JBrowse plugin: UI and backend may be cross-origin; must connect to apiBase
     * - Production behind reverse-proxy on GCP: typically same-origin /api (recommended)
     *
     * When cross-origin (e.g. JBrowse on :9000, Lorax on :8080), connect directly to apiBase.
     * When same-origin with proxy (Vite dev), use window.origin + /socket.io/ so proxy works.
     */
    const resolvedApiBase = new URL(apiBase || "/", window.location.origin);
    const isCrossOrigin = resolvedApiBase.origin !== window.location.origin;

    const apiPath = resolvedApiBase.pathname.replace(/\/$/, "");
    const prodSocketPath = apiPath ? `${apiPath}/socket.io/` : "/socket.io/";
    const devSocketPath = "/socket.io/";

    // Cross-origin: connect to apiBase (JBrowse, etc). Same-origin: use proxy path when !isProd.
    const host = isCrossOrigin ? resolvedApiBase.origin : window.location.origin;
    const path = (isCrossOrigin || isProd) ? prodSocketPath : devSocketPath;
    console.log('[useSocket] isCrossOrigin', isCrossOrigin);
    console.log('[useSocket] isProd', isProd);
    console.log('[useSocket] resolvedApiBase', resolvedApiBase);
    console.log('[useSocket] host', host);
    console.log('[useSocket] path', path);
    if (isCrossOrigin) {
      console.log('[useSocket] Cross-origin: connecting to', host, 'path', path);
    }
    const socket = io(host, {
      // Prefer websocket, allow fallback to polling for tougher proxy setups.
      transports: ["websocket", "polling"],
      withCredentials: true,
      path,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      timeout: 60000,
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
    });

    socket.on("status", (msg) => {
      setStatusMessage(msg);
      websocketEvents.emit("status", msg);
    });

    socket.on("error", (data) => {
      console.error("Socket error:", data);
      if (data.code === "SESSION_NOT_FOUND" || data.code === "MISSING_SESSION") {
        setStatusMessage({ type: 'error', message: data.message || 'Session expired. Reconnecting...' });
        onSessionError?.(data);
      } else if (data.code === "NO_FILE_LOADED") {
        setStatusMessage({ type: 'warning', message: data.message || 'No file loaded.' });
      } else {
        setStatusMessage({ type: 'error', message: data.message || 'An error occurred.' });
      }
      websocketEvents.emit("error", data);
    });

    socket.on("session-restored", (data) => {
      setStatusMessage({ message: `Session restored. File: ${data.file_path?.split('/').pop() || 'unknown'}` });
      websocketEvents.emit("session-restored", data);
    });

    if (diagnosticPingEnabled) {
      socket.on("pong", (msg) => {
        websocketEvents.emit("diagnostic-pong", msg);
      });
    }

    return socket;
  }, [apiBase, diagnosticPingEnabled, isProd, onSessionError, setStatusMessage]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  const once = useCallback((event, handler) => {
    socketRef.current?.once(event, handler);
  }, []);

  const checkConnection = useCallback(() => {
    return !!socketRef.current?.connected;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socketRef,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
    once,
    checkConnection,
    statusMessage,
    setStatusMessage
  };
}
