/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { EMPTY_LAYOUT, PARSED_LAYOUT } = vi.hoisted(() => ({
  EMPTY_LAYOUT: {
    node_id: [],
    parent_id: [],
    is_tip: [],
    tree_idx: [],
    x: [],
    y: [],
    time: [],
    name: [],
    mut_x: [],
    mut_y: [],
    mut_tree_idx: [],
    mut_node_id: [],
    tree_indices: []
  },
  PARSED_LAYOUT: {
    node_id: [100],
    parent_id: [-1],
    is_tip: [true],
    tree_idx: [7],
    x: [0.25],
    y: [0.5],
    time: [0.5],
    name: ['tip-100'],
    mut_x: [],
    mut_y: [],
    mut_tree_idx: [],
    mut_node_id: []
  }
}));

vi.mock('@lorax/core/src/utils/arrowUtils.js', () => ({
  parseTreeLayoutBuffer: vi.fn(() => PARSED_LAYOUT),
  EMPTY_TREE_LAYOUT: EMPTY_LAYOUT
}));

import { useTreeData } from '@lorax/core/src/hooks/useTreeData.jsx';
import { parseTreeLayoutBuffer } from '@lorax/core/src/utils/arrowUtils.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createResponse(treeIdx = 7) {
  return {
    buffer: new Uint8Array(),
    global_min_time: 0,
    global_max_time: 1,
    tree_indices: [treeIdx]
  };
}

describe('useTreeData fetch classification', () => {
  it('marks uncached requests as full-fetch and blocking loading', async () => {
    const first = deferred();
    const queryTreeLayout = vi.fn().mockReturnValue(first.promise);

    const { result } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [7],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200] },
        genomicCoords: [0, 100]
      }
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalled());
    expect(result.current.fetchReason).toBe('full-fetch');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isBackgroundRefresh).toBe(false);

    await act(async () => {
      first.resolve(createResponse(7));
      await first.promise;
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fetchReason).toBe('full-fetch');
  });

  it('marks warm-cache target+bbox updates as lock-refresh without blocking loading', async () => {
    const warm = deferred();
    const refresh = deferred();
    let phase = 'warm';
    const queryTreeLayout = vi.fn(() => (phase === 'warm' ? warm.promise : refresh.promise));

    const { result, rerender } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [7],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200] },
        genomicCoords: [0, 100]
      }
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalled());
    const warmFetchCallCount = queryTreeLayout.mock.calls.length;

    await act(async () => {
      warm.resolve(createResponse(7));
      await warm.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    phase = 'refresh';
    rerender({
      displayArray: [7],
      queryTreeLayout,
      isConnected: true,
      lockView: {
        targetIndex: 7,
        targetLocalBBox: {
          treeIndex: 7,
          minX: 0.1,
          maxX: 0.3,
          minY: 0.2,
          maxY: 0.4
        },
      },
      tsconfig: { intervals: [0, 100, 200] },
      genomicCoords: [0, 100]
    });

    await waitFor(() => expect(queryTreeLayout.mock.calls.length).toBeGreaterThan(warmFetchCallCount));
    const [refreshIndices, refreshOptions] = queryTreeLayout.mock.calls.at(-1);
    expect(refreshIndices).toEqual([7]);
    expect(refreshOptions.actualDisplayArray).toEqual([7]);
    expect(refreshOptions.lockView).toMatchObject({
      targetIndex: 7,
      targetLocalBBox: {
        treeIndex: 7
      }
    });
    expect(result.current.fetchReason).toBe('lock-refresh');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isBackgroundRefresh).toBe(true);

    await act(async () => {
      refresh.resolve(createResponse(7));
      await refresh.promise;
    });

    await waitFor(() => expect(result.current.isBackgroundRefresh).toBe(false));
    expect(result.current.fetchReason).toBe('lock-refresh');
  });

  it('fires lock-refresh only when target or bbox changes after cache is warm', async () => {
    const warm = deferred();
    const refreshOne = deferred();
    const refreshTwo = deferred();
    let phase = 'warm';
    const queryTreeLayout = vi.fn(() => {
      if (phase === 'warm') return warm.promise;
      if (phase === 'refresh-one') return refreshOne.promise;
      return refreshTwo.promise;
    });

    const { result, rerender } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [7],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200] },
        genomicCoords: [0, 100]
      }
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(1));
    await act(async () => {
      warm.resolve(createResponse(7));
      await warm.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    phase = 'refresh-one';
    rerender({
      displayArray: [7],
      queryTreeLayout,
      isConnected: true,
      lockView: {
        targetIndex: 7,
        targetLocalBBox: {
          treeIndex: 7,
          minX: 0.0,
          maxX: 0.5,
          minY: 0.0,
          maxY: 0.5
        }
      },
      tsconfig: { intervals: [0, 100, 200] },
      genomicCoords: [0, 100]
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(2));
    await act(async () => {
      refreshOne.resolve(createResponse(7));
      await refreshOne.promise;
    });
    await waitFor(() => expect(result.current.isBackgroundRefresh).toBe(false));

    // Same bbox => cache-only (no request)
    rerender({
      displayArray: [7],
      queryTreeLayout,
      isConnected: true,
      lockView: {
        targetIndex: 7,
        targetLocalBBox: {
          treeIndex: 7,
          minX: 0.0,
          maxX: 0.5,
          minY: 0.0,
          maxY: 0.5
        }
      },
      tsconfig: { intervals: [0, 100, 200] },
      genomicCoords: [0, 100]
    });

    expect(queryTreeLayout).toHaveBeenCalledTimes(2);
    expect(result.current.fetchReason).toBe('cache-only');

    // Changed bbox => lock-refresh should fire
    phase = 'refresh-two';
    rerender({
      displayArray: [7],
      queryTreeLayout,
      isConnected: true,
      lockView: {
        targetIndex: 7,
        targetLocalBBox: {
          treeIndex: 7,
          minX: 0.0,
          maxX: 0.6,
          minY: 0.0,
          maxY: 0.6
        }
      },
      tsconfig: { intervals: [0, 100, 200] },
      genomicCoords: [0, 100]
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(3));
    await act(async () => {
      refreshTwo.resolve(createResponse(7));
      await refreshTwo.promise;
    });
    await waitFor(() => expect(result.current.isBackgroundRefresh).toBe(false));
    expect(result.current.fetchReason).toBe('lock-refresh');
  });

  it('returns cache-only when lock payload has no qualifying target', async () => {
    const warm = deferred();
    const queryTreeLayout = vi.fn().mockReturnValue(warm.promise);

    const { result, rerender } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [7],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200] },
        genomicCoords: [0, 100]
      }
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(1));
    await act(async () => {
      warm.resolve(createResponse(7));
      await warm.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({
      displayArray: [7],
      queryTreeLayout,
      isConnected: true,
      lockView: {
        targetIndex: 7
      },
      tsconfig: { intervals: [0, 100, 200] },
      genomicCoords: [0, 100]
    });

    expect(queryTreeLayout).toHaveBeenCalledTimes(1);
    expect(result.current.fetchReason).toBe('cache-only');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isBackgroundRefresh).toBe(false);
  });

  it('skips lock override when targetIndex and targetLocalBBox tree index mismatch', async () => {
    const warm = deferred();
    const queryTreeLayout = vi.fn().mockReturnValue(warm.promise);

    const { result, rerender } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [7],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200] },
        genomicCoords: [0, 100]
      }
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(1));

    await act(async () => {
      warm.resolve(createResponse(7));
      await warm.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({
      displayArray: [7],
      queryTreeLayout,
      isConnected: true,
      lockView: {
        targetIndex: 7,
        targetLocalBBox: {
          treeIndex: 8,
          minX: 0.1,
          maxX: 0.3,
          minY: 0.2,
          maxY: 0.4
        }
      },
      tsconfig: { intervals: [0, 100, 200] },
      genomicCoords: [0, 100]
    });

    expect(queryTreeLayout).toHaveBeenCalledTimes(1);
    expect(result.current.fetchReason).toBe('cache-only');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isBackgroundRefresh).toBe(false);
  });

  it('forces full-fetch with lockView=null when display changes in lock mode', async () => {
    const warm = deferred();
    const next = deferred();
    let phase = 'warm';
    const queryTreeLayout = vi.fn(() => (phase === 'warm' ? warm.promise : next.promise));

    const { result, rerender } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [7],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200] },
        genomicCoords: [0, 100]
      }
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(1));
    await act(async () => {
      warm.resolve(createResponse(7));
      await warm.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    phase = 'next';
    rerender({
      displayArray: [8],
      queryTreeLayout,
      isConnected: true,
      lockView: {
        targetIndex: 8,
        targetLocalBBox: {
          treeIndex: 8,
          minX: 0.2,
          maxX: 0.4,
          minY: 0.2,
          maxY: 0.4
        }
      },
      tsconfig: { intervals: [0, 100, 200] },
      genomicCoords: [100, 200]
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(2));
    const [indices, options] = queryTreeLayout.mock.calls.at(-1);
    expect(indices).toEqual([8]);
    expect(options.actualDisplayArray).toEqual([8]);
    expect(options.lockView).toBeNull();
    expect(result.current.fetchReason).toBe('full-fetch');
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      next.resolve(createResponse(8));
      await next.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('replaces target-tree cache on lock-refresh when bbox-clipped response is empty', async () => {
    const warm = deferred();
    const refresh = deferred();
    let phase = 'warm';
    const queryTreeLayout = vi.fn(() => (phase === 'warm' ? warm.promise : refresh.promise));

    const parseMock = vi.mocked(parseTreeLayoutBuffer);
    parseMock.mockReset();
    parseMock
      .mockImplementationOnce(() => PARSED_LAYOUT)
      .mockImplementationOnce(() => EMPTY_LAYOUT);

    const { result, rerender } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [7],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200] },
        genomicCoords: [0, 100]
      }
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(1));
    await act(async () => {
      warm.resolve(createResponse(7));
      await warm.promise;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.treeData.node_id).toEqual([100]);

    phase = 'refresh';
    rerender({
      displayArray: [7],
      queryTreeLayout,
      isConnected: true,
      lockView: {
        targetIndex: 7,
        targetLocalBBox: {
          treeIndex: 7,
          minX: 0.1,
          maxX: 0.3,
          minY: 0.1,
          maxY: 0.2
        }
      },
      tsconfig: { intervals: [0, 100, 200] },
      genomicCoords: [0, 100]
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(2));
    await act(async () => {
      refresh.resolve(createResponse(7));
      await refresh.promise;
    });
    await waitFor(() => expect(result.current.isBackgroundRefresh).toBe(false));

    expect(result.current.fetchReason).toBe('lock-refresh');
    expect(result.current.treeData.node_id).toEqual([]);

    parseMock.mockReset();
    parseMock.mockImplementation(() => PARSED_LAYOUT);
  });

  it('returns cache-only for empty display arrays', () => {
    const queryTreeLayout = vi.fn();

    const { result } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200] },
        genomicCoords: [0, 100]
      }
    });

    expect(queryTreeLayout).not.toHaveBeenCalled();
    expect(result.current.fetchReason).toBe('cache-only');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isBackgroundRefresh).toBe(false);
    expect(result.current.treeData).toEqual(EMPTY_LAYOUT);
  });
});
