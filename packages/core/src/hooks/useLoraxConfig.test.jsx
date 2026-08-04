/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useWorker: vi.fn(),
  getIntervalWorker: vi.fn(),
  getLocalDataWorker: vi.fn()
}));

vi.mock('./useWorker.jsx', () => ({
  useWorker: mocks.useWorker
}));

vi.mock('../workers/workerSpecs.js', () => ({
  getIntervalWorker: mocks.getIntervalWorker,
  getLocalDataWorker: mocks.getLocalDataWorker
}));

import { useLoraxConfig } from './useLoraxConfig.jsx';

describe('useLoraxConfig worker fan-out', () => {
  beforeEach(() => {
    mocks.useWorker.mockReset();
  });

  it('sends config to both workers and reports combined readiness', async () => {
    const intervalWorker = {
      isReady: true,
      request: vi.fn().mockResolvedValue(null)
    };
    const localDataWorker = {
      isReady: true,
      request: vi.fn().mockResolvedValue(null)
    };

    mocks.useWorker.mockImplementation((loader) => {
      if (loader === mocks.getIntervalWorker) return intervalWorker;
      if (loader === mocks.getLocalDataWorker) return localDataWorker;
      throw new Error('Unexpected worker loader in test');
    });

    const { result } = renderHook(() => useLoraxConfig({ backend: { isConnected: false } }));

    act(() => {
      result.current.handleConfigUpdate({
        filename: 'demo.trees',
        genome_length: 100,
        intervals: [0, 10, 20, 30],
        sample_names: {},
        metadata_schema: { metadata_keys: [] }
      });
    });

    await waitFor(() => expect(intervalWorker.request).toHaveBeenCalledWith(
      'config',
      expect.objectContaining({ filename: 'demo.trees' })
    ));

    await waitFor(() => expect(localDataWorker.request).toHaveBeenCalledWith(
      'config',
      expect.objectContaining({ filename: 'demo.trees' })
    ));

    await waitFor(() => expect(result.current.workerConfigReady).toBe(true));

    await act(async () => {
      await result.current.intervalWorker.request('intervals', { start: 5, end: 25 });
      await result.current.localDataWorker.request('local-data', { lo: 0, hi: 2 });
    });

    expect(intervalWorker.request).toHaveBeenCalledWith('intervals', { start: 5, end: 25 }, undefined);
    expect(localDataWorker.request).toHaveBeenCalledWith('local-data', { lo: 0, hi: 2 }, undefined);
  });

  it('keeps workerConfigReady false until both workers are ready', () => {
    const intervalWorker = {
      isReady: true,
      request: vi.fn().mockResolvedValue(null)
    };
    const localDataWorker = {
      isReady: false,
      request: vi.fn().mockResolvedValue(null)
    };

    mocks.useWorker.mockImplementation((loader) => {
      if (loader === mocks.getIntervalWorker) return intervalWorker;
      if (loader === mocks.getLocalDataWorker) return localDataWorker;
      throw new Error('Unexpected worker loader in test');
    });

    const { result } = renderHook(() => useLoraxConfig({ backend: { isConnected: false } }));

    act(() => {
      result.current.handleConfigUpdate({
        filename: 'demo.trees',
        genome_length: 100,
        intervals: [0, 10, 20, 30],
        sample_names: {},
        metadata_schema: { metadata_keys: [] }
      });
    });

    expect(result.current.workerConfigReady).toBe(false);
    expect(intervalWorker.request).not.toHaveBeenCalledWith('config', expect.anything());
  });

  it('routes artifact interval work to the backend without inline breakpoints', async () => {
    const intervalWorker = {
      isReady: true,
      request: vi.fn().mockResolvedValue(null)
    };
    const localDataWorker = {
      isReady: true,
      request: vi.fn().mockResolvedValue(null)
    };
    mocks.useWorker.mockImplementation((loader) => {
      if (loader === mocks.getIntervalWorker) return intervalWorker;
      if (loader === mocks.getLocalDataWorker) return localDataWorker;
      throw new Error('Unexpected worker loader in test');
    });
    const backend = {
      isConnected: true,
      queryIntervals: vi.fn().mockResolvedValue({ lo: 0, hi: 2 }),
      queryLocalData: vi.fn().mockResolvedValue({ displayArray: [0] })
    };

    const { result } = renderHook(() => useLoraxConfig({ backend }));
    act(() => {
      result.current.handleConfigUpdate({
        filename: 'artifact.trees',
        genome_length: 100,
        intervals: null,
        interval_source: 'backend',
        num_trees: 4,
        num_breakpoints: 5,
        sample_names: {},
        metadata_schema: { metadata_keys: [] }
      });
    });
    await waitFor(() => expect(result.current.workerConfigReady).toBe(true));

    await act(async () => {
      await result.current.intervalWorker.request('intervals', { start: 5, end: 25 });
      await result.current.localDataWorker.request('local-data', { lo: 0, hi: 2 });
    });

    expect(backend.queryIntervals).toHaveBeenCalledWith({ start: 5, end: 25 });
    expect(backend.queryLocalData).toHaveBeenCalledWith({ lo: 0, hi: 2 });
    expect(intervalWorker.request).not.toHaveBeenCalledWith(
      'intervals',
      { start: 5, end: 25 },
      undefined
    );
    expect(localDataWorker.request).not.toHaveBeenCalledWith(
      'local-data',
      { lo: 0, hi: 2 },
      undefined
    );
    expect(result.current.globalBpPerUnit).toBe(20);
  });

  it('routes artifact intervals to the backend when an RPC worker is supplied', async () => {
    mocks.useWorker.mockReturnValue({
      isReady: false,
      request: vi.fn()
    });
    const workerOverride = {
      isReady: true,
      request: vi.fn().mockResolvedValue(null)
    };
    const backend = {
      isConnected: true,
      queryIntervals: vi.fn().mockResolvedValue({ lo: 0, hi: 2 }),
      queryLocalData: vi.fn().mockResolvedValue({ displayArray: [0] })
    };
    const { result } = renderHook(() => useLoraxConfig({
      backend,
      workerOverride
    }));

    act(() => {
      result.current.handleConfigUpdate({
        filename: 'rpc-artifact.trees',
        genome_length: 100,
        intervals: null,
        interval_source: 'backend',
        num_trees: 4,
        num_breakpoints: 5,
        sample_names: {},
        metadata_schema: { metadata_keys: [] }
      });
    });
    await waitFor(() => expect(result.current.workerConfigReady).toBe(true));

    await act(async () => {
      await result.current.intervalWorker.request('intervals', { start: 0, end: 25 });
      await result.current.localDataWorker.request('local-data', { lo: 0, hi: 2 });
    });

    expect(backend.queryIntervals).toHaveBeenCalledWith({ start: 0, end: 25 });
    expect(backend.queryLocalData).toHaveBeenCalledWith({ lo: 0, hi: 2 });
    expect(workerOverride.request).toHaveBeenCalledWith(
      'config',
      expect.objectContaining({ filename: 'rpc-artifact.trees' })
    );
  });
});
