/**
 * Timeout Constants
 * Network and async operation timeouts
 */

// Query Timeouts (in milliseconds)
export const QUERY_TIMEOUT = 30000;      // 30 seconds
export const WORKER_TIMEOUT = 60000;     // 60 seconds
export const SOCKET_TIMEOUT = 60000;     // 60 seconds

// Debounce Delays
export const DEBOUNCE_DELAY = 100;       // 100ms for view updates
export const REGION_QUERY_DEBOUNCE = 400; // 400ms for region queries

// Keep-Alive
export const KEEP_ALIVE_INTERVAL = 5000; // 5 seconds

// Socket.IO Configuration (should match backend)
export const SOCKET_PING_TIMEOUT = 60000;   // 60 seconds
export const SOCKET_PING_INTERVAL = 25000;  // 25 seconds

// Reconnection
export const RECONNECTION_ATTEMPTS = 10;
export const RECONNECTION_DELAY = 3000;  // 3 seconds
