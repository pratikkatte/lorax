import { useMemo } from "react";

export default function useLoraxConfig() {
  const isProd = import.meta.env.PROD;

  let API_BASE = import.meta.env.VITE_API_BASE || "";

  if (isProd) {
    if (API_BASE.startsWith("/")) {
      API_BASE = window.location.origin + API_BASE;
    }
  }

  return useMemo(() => {
    return {
      API_BASE,
      IS_PROD: isProd
    };
  }, [API_BASE, isProd]);
}
