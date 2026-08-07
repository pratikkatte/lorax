export const isProd = import.meta.env.PROD;

// Use the same-origin Vite proxy in development as well as the bundled app.
// Safari can resolve `localhost` to IPv6 while a local backend is bound only to
// IPv4, which leaves direct requests to localhost:8080 disconnected.
export const apiBase = import.meta.env.VITE_API_BASE || '/api';
