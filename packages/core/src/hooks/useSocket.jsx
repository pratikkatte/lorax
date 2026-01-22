import { useRef, useState, useCallback, useEffect } from "react";
import { io } from "socket.io-client";
import websocketEvents from "../utils/websocketEvents.js";

export function useSocket({
  apiBase,
  isProd = false,
  onSessionError
}) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ message: null });

  const connect = useCallback(() => {
    if (socketRef.current) {
      console.log("Socket already connected");
      return;
    }

    const url = new URL(apiBase);
    const host = `${url.protocol}//${url.hostname}:${url.port}`;
    const path = `${url.pathname}/socket.io/`;

    const socket = io(host, {
      transports: ["websocket"],
      withCredentials: true,
      path: isProd ? path : "/socket.io/",
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      timeout: 60000,
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket.IO connected");
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.IO disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("status", (msg) => {
      console.log("status", msg);
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
      console.log("Session restored:", data);
      setStatusMessage({ message: `Session restored. File: ${data.file_path?.split('/').pop() || 'unknown'}` });
      websocketEvents.emit("session-restored", data);
    });

    socket.on("pong", (msg) => {
      // Keep-alive response
    });

    return socket;
  }, [apiBase, isProd, onSessionError, setStatusMessage]);

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
