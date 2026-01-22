export function getApiBase(apiBase, isProd = false) {
  let base = apiBase || "";

  if (isProd && base.startsWith("/")) {
    base = window.location.origin + base;
  }

  return base;
}

export function getLoraxConfig(apiBase, isProd = false) {
  return {
    API_BASE: getApiBase(apiBase, isProd),
    IS_PROD: isProd
  };
}
