import { useMemo } from "react";

export default function useLoraxConfig() {
  const isProd = import.meta.env.PROD;

  let API_BASE = import.meta.env.VITE_API_BASE || "";
  let WEBSOCKET_BASE = import.meta.env.VITE_WEBSOCKET_BASE || "";

  // If using relative paths in prod, convert them to absolute
  if (isProd) {
    if (API_BASE.startsWith('/')) {
      API_BASE = window.location.origin + API_BASE;
    }
    if (WEBSOCKET_BASE.startsWith('/')) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      WEBSOCKET_BASE = wsProtocol + '//' + window.location.host + WEBSOCKET_BASE;
    }
  }

  return useMemo(() => {
    return {
      API_BASE,
      WEBSOCKET_BASE,
    };
  }, [API_BASE, WEBSOCKET_BASE]);
}
