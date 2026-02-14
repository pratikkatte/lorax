/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  useSession: vi.fn(),
  useSocket: vi.fn()
}));

vi.mock("./useSession.jsx", () => ({
  useSession: mocked.useSession
}));

vi.mock("./useSocket.jsx", () => ({
  useSocket: mocked.useSocket
}));

import { useLoraxConnection } from "./useLoraxConnection.jsx";

describe("useLoraxConnection diagnostics keepalive", () => {
  let emit;
  let setIntervalSpy;
  let clearIntervalSpy;

  beforeEach(() => {
    vi.useFakeTimers();

    emit = vi.fn();

    mocked.useSession.mockReturnValue({
      loraxSid: "sid-1",
      sidRef: { current: "sid-1" },
      initializeSession: vi.fn().mockResolvedValue(undefined),
      clearSession: vi.fn()
    });

    mocked.useSocket.mockReturnValue({
      socketRef: { current: null },
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit,
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      checkConnection: vi.fn().mockReturnValue(true),
      statusMessage: { message: null },
      setStatusMessage: vi.fn()
    });

    setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not schedule periodic ping by default", () => {
    renderHook(() => useLoraxConnection({ apiBase: "/api", diagnosticPingEnabled: false }));
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("schedules diagnostics ping only when explicitly enabled", async () => {
    renderHook(() =>
      useLoraxConnection({
        apiBase: "/api",
        diagnosticPingEnabled: true,
        diagnosticPingIntervalMs: 1000
      })
    );

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15000);

    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    expect(emit).toHaveBeenCalledWith(
      "ping",
      expect.objectContaining({
        source: "diagnostic",
        time: expect.any(Number)
      })
    );
  });
});
