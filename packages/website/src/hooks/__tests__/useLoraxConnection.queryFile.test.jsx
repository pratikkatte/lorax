/* @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let sessionState;
let socketState;

vi.mock("@lorax/core/src/hooks/useSession.jsx", () => ({
  useSession: () => sessionState,
}));

vi.mock("@lorax/core/src/hooks/useSocket.jsx", () => ({
  useSocket: () => socketState,
}));

import { useLoraxConnection } from "@lorax/core/src/hooks/useLoraxConnection.jsx";

function createSocketHarness(ackImplementation) {
  const listeners = new Map();
  const addListener = (event, handler) => {
    const handlers = listeners.get(event) || new Set();
    handlers.add(handler);
    listeners.set(event, handlers);
  };
  const removeListener = (event, handler) => {
    const handlers = listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      listeners.delete(event);
    }
  };

  const ackEmit = vi.fn((event, payload, callback) => {
    if (ackImplementation) {
      ackImplementation(event, payload, callback);
    }
  });

  const socket = {
    timeout: vi.fn(() => ({ emit: ackEmit })),
    emit: vi.fn(),
  };

  return {
    socket,
    ackEmit,
    emitEvent(event, payload) {
      const handlers = listeners.get(event);
      if (!handlers) return;
      [...handlers].forEach((handler) => handler(payload));
    },
    listenerCount(event) {
      return listeners.get(event)?.size || 0;
    },
    socketApi: {
      socketRef: { current: socket },
      isConnected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn((event, payload) => socket.emit(event, payload)),
      on: vi.fn(addListener),
      off: vi.fn(removeListener),
      once: vi.fn((event, handler) => {
        const wrapper = (message) => {
          removeListener(event, wrapper);
          handler(message);
        };
        addListener(event, wrapper);
      }),
      checkConnection: vi.fn(() => true),
      statusMessage: { message: null },
      setStatusMessage: vi.fn(),
    },
  };
}

describe("useLoraxConnection.queryFile", () => {
  beforeEach(() => {
    sessionState = {
      loraxSid: "session-1",
      sidRef: { current: "session-1" },
      initializeSession: vi.fn(() => Promise.resolve()),
      clearSession: vi.fn(),
    };
    socketState = createSocketHarness().socketApi;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("resolves on successful acknowledgement response", async () => {
    const harness = createSocketHarness((event, payload, callback) => {
      callback(null, {
        ok: true,
        request_id: payload.request_id,
        filename: payload.file,
        project: payload.project,
        owner_sid: payload.lorax_sid,
        config: { initial_position: [0, 1] },
        code: "FILE_LOADED",
      });
    });
    socketState = harness.socketApi;

    const { result } = renderHook(() =>
      useLoraxConnection({ apiBase: "http://localhost:8080", isProd: false })
    );

    const response = await result.current.queryFile({ project: "Uploads", file: "a.trees" });
    expect(response.ok).toBe(true);
    expect(response.filename).toBe("a.trees");
    expect(harness.listenerCount("load-file-result")).toBe(0);
    expect(harness.listenerCount("disconnect")).toBe(0);
  });

  it("rejects when acknowledgement returns an error payload", async () => {
    const harness = createSocketHarness((event, payload, callback) => {
      callback(null, {
        ok: false,
        request_id: payload.request_id,
        code: "FILE_NOT_FOUND",
        message: "File not found",
        recoverable: true,
      });
    });
    socketState = harness.socketApi;

    const { result } = renderHook(() =>
      useLoraxConnection({ apiBase: "http://localhost:8080", isProd: false })
    );

    await expect(result.current.queryFile({ project: "Uploads", file: "missing.trees" })).rejects.toMatchObject({
      message: "File not found",
      code: "FILE_NOT_FOUND",
    });
    expect(harness.listenerCount("load-file-result")).toBe(0);
    expect(harness.listenerCount("disconnect")).toBe(0);
  });

  it("rejects on client-side timeout when no terminal response arrives", async () => {
    vi.useFakeTimers();
    const harness = createSocketHarness((event, payload, callback) => {
      callback(new Error("ack timeout"));
    });
    socketState = harness.socketApi;

    const { result } = renderHook(() =>
      useLoraxConnection({ apiBase: "http://localhost:8080", isProd: false })
    );

    const pending = result.current.queryFile({ project: "Uploads", file: "slow.trees" });
    const assertion = expect(pending).rejects.toThrow("Timed out waiting for load_file result.");
    await vi.advanceTimersByTimeAsync(120001);

    await assertion;
    expect(harness.listenerCount("load-file-result")).toBe(0);
    expect(harness.listenerCount("disconnect")).toBe(0);
  });

  it("rejects when socket disconnects during load", async () => {
    const harness = createSocketHarness((event, payload, callback) => {
      callback(new Error("ack timeout"));
    });
    socketState = harness.socketApi;

    const { result } = renderHook(() =>
      useLoraxConnection({ apiBase: "http://localhost:8080", isProd: false })
    );

    const pending = result.current.queryFile({ project: "Uploads", file: "a.trees" });
    harness.emitEvent("disconnect");

    await expect(pending).rejects.toThrow("Socket disconnected during file load.");
    expect(harness.listenerCount("load-file-result")).toBe(0);
    expect(harness.listenerCount("disconnect")).toBe(0);
  });

  it("does not leave dangling listeners after legacy event fallback success", async () => {
    const harness = createSocketHarness((event, payload, callback) => {
      callback(new Error("ack timeout"));
      setTimeout(() => {
        harness.emitEvent("load-file-result", {
          ok: true,
          request_id: payload.request_id,
          filename: payload.file,
          project: payload.project,
          owner_sid: payload.lorax_sid,
          config: { initial_position: [1, 2] },
          code: "FILE_LOADED",
        });
      }, 0);
    });
    socketState = harness.socketApi;

    const { result } = renderHook(() =>
      useLoraxConnection({ apiBase: "http://localhost:8080", isProd: false })
    );

    const response = await result.current.queryFile({ project: "Uploads", file: "a.trees" });
    expect(response.ok).toBe(true);
    expect(harness.listenerCount("load-file-result")).toBe(0);
    expect(harness.listenerCount("disconnect")).toBe(0);
  });
});
