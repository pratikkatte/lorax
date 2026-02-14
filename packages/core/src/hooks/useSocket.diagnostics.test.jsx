/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  io: vi.fn()
}));

vi.mock("socket.io-client", () => ({
  io: mocked.io
}));

import { useSocket } from "./useSocket.jsx";

function createSocketMock() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true
  };
}

describe("useSocket diagnostics pong listener", () => {
  beforeEach(() => {
    mocked.io.mockReset();
    mocked.io.mockImplementation(() => createSocketMock());
  });

  it("does not register pong listener by default", () => {
    const { result } = renderHook(() => useSocket({ apiBase: "/api" }));

    act(() => {
      result.current.connect();
    });

    const socket = mocked.io.mock.results[0].value;
    expect(socket.on).not.toHaveBeenCalledWith("pong", expect.any(Function));
  });

  it("registers pong listener when diagnostics are enabled", () => {
    const { result } = renderHook(() =>
      useSocket({ apiBase: "/api", diagnosticPingEnabled: true })
    );

    act(() => {
      result.current.connect();
    });

    const socket = mocked.io.mock.results[0].value;
    expect(socket.on).toHaveBeenCalledWith("pong", expect.any(Function));
  });
});

