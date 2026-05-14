export const isProd = import.meta.env.PROD;

// In the bundled single-port app, the backend is mounted under same-origin `/api`.
// Keep localhost:8080 as the default for non-prod dev usage.
export const apiBase = import.meta.env.VITE_API_BASE || (isProd ? '/api' : 'http://localhost:8080');
