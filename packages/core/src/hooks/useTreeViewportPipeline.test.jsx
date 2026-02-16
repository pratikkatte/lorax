/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookMocks = vi.hoisted(() => ({
  useInterval: vi.fn(),
  useLocalData: vi.fn(),
  useTreeData: vi.fn(),
  useRenderData: vi.fn()
}));

vi.mock('./useInterval.jsx', () => ({
  useInterval: hookMocks.useInterval
}));

vi.mock('./useLocalData.jsx', () => ({
  useLocalData: hookMocks.useLocalData
}));

vi.mock('./useTreeData.jsx', () => ({
  useTreeData: hookMocks.useTreeData
}));

vi.mock('./useRenderData.jsx', () => ({
  useRenderData: hookMocks.useRenderData
}));

import { useTreeViewportPipeline } from './useTreeViewportPipeline.jsx';

describe('useTreeViewportPipeline worker routing', () => {
  beforeEach(() => {
    hookMocks.useInterval.mockReset().mockReturnValue({
      visibleIntervals: [10],
      intervalBounds: { lo: 1, hi: 4 },
      intervalCount: 3,
      intervalsCoords: [100, 200],
      isReady: true,
      reset: vi.fn()
    });

    hookMocks.useLocalData.mockReset().mockReturnValue({
      localBins: new Map([[2, { global_index: 2 }]]),
      displayArray: [2],
      showingAllTrees: false,
      isReady: true,
      reset: vi.fn()
    });

    hookMocks.useTreeData.mockReset().mockReturnValue({
      treeData: { node_id: [] },
      isLoading: false,
      isBackgroundRefresh: false,
      fetchReason: null,
      error: null
    });

    hookMocks.useRenderData.mockReset().mockReturnValue({
      renderData: null,
      isLoading: false,
      error: null,
      isReady: true,
      clearBuffers: vi.fn()
    });
  });

  it('passes intervalWorker to useInterval and localDataWorker to useLocalData', () => {
    const intervalWorker = { request: vi.fn() };
    const localDataWorker = { request: vi.fn() };

    renderHook(() => useTreeViewportPipeline({
      intervalWorker,
      localDataWorker,
      workerConfigReady: true,
      genomicCoords: [100, 200],
      viewState: { ortho: { zoom: [8, 8], target: [0, 0] } },
      tsconfig: { genome_length: 1000, intervals: [0, 10, 20] },
      queryTreeLayout: vi.fn(),
      isConnected: true,
      isInteracting: true
    }));

    expect(hookMocks.useInterval).toHaveBeenCalledWith(expect.objectContaining({
      worker: intervalWorker,
      isInteracting: true
    }));

    expect(hookMocks.useLocalData).toHaveBeenCalledWith(expect.objectContaining({
      worker: localDataWorker
    }));
  });

  it('falls back to shared worker when dedicated workers are not provided', () => {
    const sharedWorker = { request: vi.fn() };

    renderHook(() => useTreeViewportPipeline({
      worker: sharedWorker,
      workerConfigReady: true,
      genomicCoords: [100, 200],
      viewState: { ortho: { zoom: [8, 8], target: [0, 0] } },
      tsconfig: { genome_length: 1000, intervals: [0, 10, 20] },
      queryTreeLayout: vi.fn(),
      isConnected: true
    }));

    expect(hookMocks.useInterval).toHaveBeenCalledWith(expect.objectContaining({
      worker: sharedWorker
    }));

    expect(hookMocks.useLocalData).toHaveBeenCalledWith(expect.objectContaining({
      worker: sharedWorker
    }));
  });
});
