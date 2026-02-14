const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export const DEFAULT_DIAGNOSTIC_PING_INTERVAL_MS = 15000;
export const MIN_DIAGNOSTIC_PING_INTERVAL_MS = 15000;

function parseBooleanFlag(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) return true;
    if (FALSE_VALUES.has(normalized)) return false;
  }

  return fallback;
}

function parseIntervalMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(MIN_DIAGNOSTIC_PING_INTERVAL_MS, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(MIN_DIAGNOSTIC_PING_INTERVAL_MS, parsed);
    }
  }

  return DEFAULT_DIAGNOSTIC_PING_INTERVAL_MS;
}

export function resolveDiagnosticPingConfig({
  enabledOverride,
  intervalOverrideMs,
  env = {}
} = {}) {
  const enabledFromEnv = parseBooleanFlag(env?.VITE_LORAX_DIAGNOSTIC_PING_ENABLED, false);
  const enabled = typeof enabledOverride === "boolean" ? enabledOverride : enabledFromEnv;

  return {
    enabled,
    intervalMs: parseIntervalMs(
      intervalOverrideMs ?? env?.VITE_LORAX_DIAGNOSTIC_PING_INTERVAL_MS
    )
  };
}

