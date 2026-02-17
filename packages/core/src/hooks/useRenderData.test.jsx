/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  workerApi: {
    isReady: true,
    request: vi.fn()
  },
  useWorker: vi.fn()
}));

vi.mock('./useWorker.jsx', () => ({
  useWorker: mocks.useWorker
}));

import { useRenderData } from './useRenderData.jsx';

function modelMatrix(scaleX = 1, translateX = 0) {
  return [
    scaleX, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    translateX, 0, 0, 1
  ];
}

function createRenderResult() {
  return {
    pathPositions: new Float64Array([0, 0, 1, 0, 1, 1]),
    pathStartIndices: new Uint32Array([0, 3]),
    tipPositions: new Float64Array([1, 1]),
    tipColors: new Uint8Array([10, 20, 30, 200]),
    tipData: [{ node_id: 1, tree_idx: 7, position: [1, 1], name: 'tip-1' }],
    treeLabelMeta: [{ tree_idx: 7, nodeCount: 6000, scaleX: 1 }],
    edgeData: [{ tree_idx: 7, parent_id: 0, child_id: 1 }],
    edgeCount: 1,
    tipCount: 1,
    mutPositions: new Float64Array(0),
    mutCount: 0
  };
}

function createLargeTreeData(nodeCount = 6000, treeIdx = 7) {
  return {
    node_id: Array.from({ length: nodeCount }, (_, i) => i + 1),
    parent_id: Array.from({ length: nodeCount }, () => -1),
    is_tip: Array.from({ length: nodeCount }, () => 1),
    tree_idx: Array.from({ length: nodeCount }, () => treeIdx),
    x: Array.from({ length: nodeCount }, (_, i) => i / nodeCount),
    y: Array.from({ length: nodeCount }, () => 1),
    name: Array.from({ length: nodeCount }, (_, i) => `tip-${i + 1}`),
    mut_x: [],
    mut_y: [],
    mut_tree_idx: []
  };
}

function createBaseProps() {
  return {
    localBins: new Map([[7, { modelMatrix: modelMatrix(1, 0), visible: true }]]),
    treeData: createLargeTreeData(),
    displayArray: [7],
    metadataArrays: {
      keyA: { uniqueValues: ['A'], indices: new Uint16Array([0]), nodeIdToIdx: new Map([[1, 0]]) },
      keyB: { uniqueValues: ['B'], indices: new Uint16Array([0]), nodeIdToIdx: new Map([[1, 0]]) }
    },
    metadataColors: {
      keyA: { A: [10, 20, 30, 255] },
      keyB: { B: [120, 130, 140, 255] }
    },
    populationFilter: {
      colorBy: 'keyA',
      enabledValues: ['A']
    }
  };
}

describe('useRenderData tip color recompute', () => {
  beforeEach(() => {
    mocks.useWorker.mockReset();
    mocks.workerApi.request.mockReset();
    mocks.useWorker.mockReturnValue(mocks.workerApi);
    mocks.workerApi.request.mockImplementation(async (type) => {
      if (type === 'apply-transform') {
        return { ...createRenderResult(), cacheMiss: false };
      }
      return createRenderResult();
    });
  });

  it('runs full compute when metadata key changes even if matrices and structure are unchanged', async () => {
    const baseProps = createBaseProps();
    const { rerender } = renderHook((props) => useRenderData(props), {
      initialProps: baseProps
    });

    await waitFor(() => expect(mocks.workerApi.request).toHaveBeenCalledTimes(1));
    expect(mocks.workerApi.request.mock.calls[0][0]).toBe('compute-render-data');

    rerender({
      ...baseProps,
      populationFilter: {
        colorBy: 'keyB',
        enabledValues: ['B']
      }
    });

    await waitFor(() => expect(mocks.workerApi.request).toHaveBeenCalledTimes(2));
    expect(mocks.workerApi.request.mock.calls[1][0]).toBe('compute-render-data');
  });

  it('keeps no-op optimization when tip-color inputs are unchanged', async () => {
    const baseProps = createBaseProps();
    const { rerender } = renderHook((props) => useRenderData(props), {
      initialProps: baseProps
    });

    await waitFor(() => expect(mocks.workerApi.request).toHaveBeenCalledTimes(1));

    rerender({
      ...baseProps,
      populationFilter: {
        colorBy: 'keyA',
        enabledValues: ['A']
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mocks.workerApi.request).toHaveBeenCalledTimes(1);
  });
});
