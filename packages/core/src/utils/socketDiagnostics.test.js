import { describe, expect, it } from "vitest";

import {
  DEFAULT_DIAGNOSTIC_PING_INTERVAL_MS,
  resolveDiagnosticPingConfig
} from "./socketDiagnostics.js";

describe("resolveDiagnosticPingConfig", () => {
  it("keeps diagnostics ping disabled by default", () => {
    const config = resolveDiagnosticPingConfig();
    expect(config.enabled).toBe(false);
    expect(config.intervalMs).toBe(DEFAULT_DIAGNOSTIC_PING_INTERVAL_MS);
  });

  it("enables diagnostics ping from env", () => {
    const config = resolveDiagnosticPingConfig({
      env: { VITE_LORAX_DIAGNOSTIC_PING_ENABLED: "true" }
    });
    expect(config.enabled).toBe(true);
  });

  it("clamps interval to the minimum floor", () => {
    const config = resolveDiagnosticPingConfig({
      enabledOverride: true,
      intervalOverrideMs: 500
    });
    expect(config.enabled).toBe(true);
    expect(config.intervalMs).toBe(15000);
  });
});

