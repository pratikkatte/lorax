/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseTreeLayoutBuffer: vi.fn()
}));

vi.mock('../utils/arrowUtils.js', () => ({
  parseTreeLayoutBuffer: mocks.parseTreeLayoutBuffer,
  EMPTY_TREE_LAYOUT: {
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
    mut_id: [],
    mut_site_id: [],
    mut_position: [],
    mut_time: [],
    mut_ancestral_state: [],
    mut_derived_state: [],
    mut_inherited_state: [],
    tree_indices: []
  }
}));

import { useTreeData } from './useTreeData.jsx';

function parsedForTreeIndices(indices) {
  return {
    node_id: indices.map((idx) => idx * 10 + 1),
    parent_id: indices.map(() => -1),
    is_tip: indices.map(() => 1),
    tree_idx: indices,
    x: indices.map(() => 0.5),
    y: indices.map(() => 1),
    time: indices.map(() => 1),
    name: indices.map((idx) => `tip-${idx}`),
    mut_x: [],
    mut_y: [],
    mut_tree_idx: [],
    mut_node_id: [],
    mut_id: [],
    mut_site_id: [],
    mut_position: [],
    mut_time: [],
    mut_ancestral_state: [],
    mut_derived_state: [],
    mut_inherited_state: []
  };
}

function createProps(overrides = {}) {
  return {
    displayArray: [1],
    queryTreeLayout: vi.fn(async (indices) => ({
      buffer: indices,
      global_min_time: 0,
      global_max_time: 1
    })),
    isConnected: true,
    timeScale: 'linear',
    tsconfig: {
      file_path: 'sample.trees',
      intervals: [0, 10, 20, 30, 40]
    },
    genomicCoords: [0, 40],
    ...overrides
  };
}

describe('useTreeData cache invalidation', () => {
  beforeEach(() => {
    mocks.parseTreeLayoutBuffer.mockReset();
    mocks.parseTreeLayoutBuffer.mockImplementation(parsedForTreeIndices);
  });

  it('keeps cached trees when displayArray grows from one tree to many', async () => {
    const baseProps = createProps();
    const { result, rerender } = renderHook((props) => useTreeData(props), {
      initialProps: baseProps
    });

    await waitFor(() => expect(baseProps.queryTreeLayout).toHaveBeenCalledTimes(1));
    expect(baseProps.queryTreeLayout.mock.calls[0][0]).toEqual([1]);
    await waitFor(() => expect(result.current.treeData?.tree_indices).toEqual([1]));

    rerender({
      ...baseProps,
      displayArray: [1, 2, 3]
    });

    await waitFor(() => expect(baseProps.queryTreeLayout).toHaveBeenCalledTimes(2));
    expect(baseProps.queryTreeLayout.mock.calls[1][0]).toEqual([2, 3]);
    await waitFor(() => expect(result.current.treeData?.tree_indices).toEqual([1, 2, 3]));
  });

  it('clears cached trees when timeScale changes', async () => {
    const baseProps = createProps();
    const { rerender } = renderHook((props) => useTreeData(props), {
      initialProps: baseProps
    });

    await waitFor(() => expect(baseProps.queryTreeLayout).toHaveBeenCalledTimes(1));

    rerender({
      ...baseProps,
      timeScale: 'log'
    });

    await waitFor(() => expect(baseProps.queryTreeLayout).toHaveBeenCalledTimes(2));
    expect(baseProps.queryTreeLayout.mock.calls[1][0]).toEqual([1]);
    expect(baseProps.queryTreeLayout.mock.calls[1][1]).toMatchObject({
      timeScale: 'log'
    });
  });
});
