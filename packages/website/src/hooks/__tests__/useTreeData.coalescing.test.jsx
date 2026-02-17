/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { EMPTY_LAYOUT } = vi.hoisted(() => ({
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
  }
}));

vi.mock('@lorax/core/src/utils/arrowUtils.js', () => ({
  parseTreeLayoutBuffer: vi.fn(),
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

function createParsedLayout(treeIdx, nodeId) {
  return {
    node_id: [nodeId],
    parent_id: [-1],
    is_tip: [true],
    tree_idx: [treeIdx],
    x: [0.1],
    y: [0.2],
    time: [0.2],
    name: [`tip-${treeIdx}`],
    mut_x: [],
    mut_y: [],
    mut_tree_idx: [],
    mut_node_id: []
  };
}

function createResponse(treeIdx) {
  return {
    buffer: new Uint8Array(),
    global_min_time: 0,
    global_max_time: 1,
    tree_indices: [treeIdx]
  };
}

describe('useTreeData request coalescing', () => {
  it('runs at most one in-flight backend request and keeps only latest queued display update', async () => {
    const first = deferred();
    const second = deferred();
    const queryTreeLayout = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const parseMock = vi.mocked(parseTreeLayoutBuffer);
    parseMock.mockReset();
    parseMock
      .mockImplementationOnce(() => createParsedLayout(1, 101))
      .mockImplementationOnce(() => createParsedLayout(3, 303));

    const { result, rerender } = renderHook((props) => useTreeData(props), {
      initialProps: {
        displayArray: [1],
        queryTreeLayout,
        isConnected: true,
        lockView: null,
        tsconfig: { intervals: [0, 100, 200, 300, 400] },
        genomicCoords: [0, 100]
      }
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(1));

    // Queue two newer display windows while first request is unresolved.
    rerender({
      displayArray: [2],
      queryTreeLayout,
      isConnected: true,
      lockView: null,
      tsconfig: { intervals: [0, 100, 200, 300, 400] },
      genomicCoords: [100, 200]
    });
    rerender({
      displayArray: [3],
      queryTreeLayout,
      isConnected: true,
      lockView: null,
      tsconfig: { intervals: [0, 100, 200, 300, 400] },
      genomicCoords: [200, 300]
    });

    expect(queryTreeLayout).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(createResponse(1));
      await first.promise;
    });

    await waitFor(() => expect(queryTreeLayout).toHaveBeenCalledTimes(2));
    const [indices, options] = queryTreeLayout.mock.calls.at(-1);
    expect(indices).toEqual([3]);
    expect(options.actualDisplayArray).toEqual([3]);

    // First response should not be applied because newer work is pending.
    expect(result.current.treeData).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      second.resolve(createResponse(3));
      await second.promise;
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.treeData.tree_indices).toEqual([3]);
    expect(queryTreeLayout).toHaveBeenCalledTimes(2);
  });
});

