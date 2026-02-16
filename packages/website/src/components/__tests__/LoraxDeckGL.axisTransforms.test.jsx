/* @vitest-environment jsdom */

import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let loraxState;
let localDataState;
let treeDataState;
let renderDataState;
let capturedRenderData;

function createModelMatrix({
  scaleX,
  translateX,
  scaleY = 1,
  translateY = 0
}) {
  const m = new Array(16).fill(0);
  m[0] = scaleX;
  m[5] = scaleY;
  m[12] = translateX;
  m[13] = translateY;
  return m;
}

function createBaseRenderData() {
  return {
    pathPositions: new Float64Array([0, 0, 1, 1]),
    pathStartIndices: new Uint32Array([0, 2]),
    tipPositions: new Float64Array([0, 0]),
    tipColors: new Uint8Array([0, 0, 0, 0]),
    tipData: [],
    treeLabelMeta: [],
    edgeData: [],
    edgeCount: 0,
    tipCount: 0,
    mutPositions: new Float64Array(0),
    mutCount: 0
  };
}

function expectPathClose(actualPath, expectedPath) {
  expect(actualPath).toHaveLength(expectedPath.length);
  for (let i = 0; i < expectedPath.length; i++) {
    expect(actualPath[i][0]).toBeCloseTo(expectedPath[i][0]);
    expect(actualPath[i][1]).toBeCloseTo(expectedPath[i][1]);
  }
}

vi.mock('@deck.gl/react', async () => {
  const ReactMod = await import('react');
  return {
    default: ReactMod.forwardRef(({ children }, ref) => {
      const deck = {
        getViewports: () => ([
          {
            id: 'ortho',
            width: 100,
            height: 50,
            x: 0,
            y: 0,
            unproject: ([x, y]) => [x, y, 0]
          }
        ]),
        canvas: { width: 100, height: 50, clientWidth: 100, clientHeight: 50 }
      };
      ReactMod.useImperativeHandle(ref, () => ({ deck }));
      return <div>{children}</div>;
    })
  };
});

vi.mock('@deck.gl/core', async () => {
  const ReactMod = await import('react');
  return {
    View: ({ children }) => <div>{children}</div>
  };
});

vi.mock('@lorax/core/src/context/LoraxProvider.jsx', () => ({
  useLorax: () => loraxState
}));

vi.mock('@lorax/core/src/hooks/useDeckController.jsx', () => ({
  useDeckController: () => ({
    zoomAxis: 'all',
    panDirection: null,
    wheelPanDeltaX: 0
  })
}));

vi.mock('@lorax/core/src/hooks/useDeckViews.jsx', () => ({
  useDeckViews: () => ({
    views: [{ id: 'ortho' }],
    viewState: {
      ortho: { zoom: [5, 8], target: [0, 0] },
      'tree-time': { zoom: [0, 8], target: [0, 0] }
    },
    handleViewStateChange: vi.fn(),
    decksize: { width: 100, height: 50 },
    setDecksize: vi.fn(),
    xzoom: 5,
    yzoom: 8,
    viewReset: vi.fn(),
    fitYToBounds: vi.fn(),
    genomicCoords: [0, 100],
    setGenomicCoords: vi.fn(),
    coordsReady: true
  })
}));

vi.mock('@lorax/core/src/hooks/useInterval.jsx', () => ({
  useInterval: () => ({
    visibleIntervals: [],
    intervalBounds: { lo: 0, hi: 1 },
    intervalCount: 2,
    intervalsCoords: [0, 100]
  })
}));

vi.mock('@lorax/core/src/hooks/useLocalData.jsx', () => ({
  useLocalData: () => localDataState
}));

vi.mock('@lorax/core/src/hooks/useTreeData.jsx', () => ({
  useTreeData: () => treeDataState
}));

vi.mock('@lorax/core/src/hooks/useRenderData.jsx', () => ({
  useRenderData: () => renderDataState
}));

vi.mock('@lorax/core/src/hooks/useGenomePositions.jsx', () => ({
  useGenomePositions: () => []
}));

vi.mock('@lorax/core/src/hooks/useTimePositions.jsx', () => ({
  useTimePositions: () => []
}));

vi.mock('@lorax/core/src/hooks/useTreePolygons.jsx', () => ({
  useTreePolygons: () => ({
    polygons: [],
    hoveredPolygon: null,
    setHoveredPolygon: vi.fn(),
    isReady: true,
    onAfterRender: vi.fn()
  })
}));

vi.mock('@lorax/core/src/hooks/useDeckLayers.jsx', () => ({
  useDeckLayers: (args) => {
    capturedRenderData = args.renderData;
    return {
      layers: [],
      layerFilter: null,
      clearHover: vi.fn()
    };
  }
}));

vi.mock('@lorax/core/src/components/TreePolygonOverlay.jsx', () => ({
  default: () => null
}));

vi.mock('@lorax/core/src/utils/deckViewConfig.js', () => ({
  mergeWithDefaults: (config) => config || { ortho: { enabled: true } },
  validateViewConfig: () => {},
  getEnabledViews: () => ['ortho']
}));

vi.mock('@lorax/core/src/utils/deckglToSvg.js', () => ({
  getSVG: () => '<svg />'
}));

import LoraxDeckGL from '@lorax/core/src/components/LoraxDeckGL.jsx';

describe('LoraxDeckGL canonical local-coordinate mapping', () => {
  beforeEach(() => {
    capturedRenderData = null;

    loraxState = {
      globalBpPerUnit: 1,
      genomeLength: 1000,
      tsconfig: { value: [0, 100], intervals: [0, 100] },
      worker: null,
      workerConfigReady: true,
      queryTreeLayout: vi.fn(),
      queryHighlightPositions: vi.fn(),
      queryMultiValueSearch: vi.fn(),
      emitCompareTrees: vi.fn(),
      compareTreesResult: null,
      isConnected: false,
      metadataArrays: null,
      metadataColors: null,
      selectedColorBy: null,
      enabledValues: new Set(),
      highlightedMetadataValue: null,
      searchTags: [],
      displayLineagePaths: false,
      compareMode: false
    };

    localDataState = {
      localBins: new Map([
        [0, { global_index: 0, modelMatrix: createModelMatrix({ scaleX: 10, translateX: 100, scaleY: 2, translateY: 5 }) }]
      ]),
      displayArray: [0],
      showingAllTrees: false
    };

    treeDataState = {
      treeData: {
        node_id: [10, 11],
        parent_id: [-1, 10],
        is_tip: [false, true],
        tree_idx: [0, 0],
        x: [0.2, 0.8],
        y: [0.4, 0.9],
        mut_node_id: [],
        mut_tree_idx: [],
        mut_x: [],
        mut_y: [],
        global_min_time: 0,
        global_max_time: 1
      },
      isLoading: false,
      error: null
    };

    renderDataState = {
      renderData: createBaseRenderData(),
      isLoading: false
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps mutation highlights using local mut_x/mut_y coordinates', () => {
    treeDataState = {
      ...treeDataState,
      treeData: {
        ...treeDataState.treeData,
        mut_node_id: [42],
        mut_tree_idx: [0],
        mut_x: [0.3],
        mut_y: [0.7]
      }
    };

    render(
      <LoraxDeckGL
        viewConfig={{ ortho: { enabled: true } }}
        highlightedMutationNode={42}
        highlightedMutationTreeIndex={0}
      />
    );

    expect(capturedRenderData).not.toBeNull();
    expect(capturedRenderData.highlightData).toHaveLength(1);
    expect(capturedRenderData.highlightData[0].localPosition[0]).toBeCloseTo(0.3);
    expect(capturedRenderData.highlightData[0].localPosition[1]).toBeCloseTo(0.7);
  });

  it('maps compare edges using local parent_x/child_x and parent_y/child_y', () => {
    localDataState = {
      ...localDataState,
      localBins: new Map([
        [0, { global_index: 0, modelMatrix: createModelMatrix({ scaleX: 10, translateX: 100, scaleY: 2, translateY: 5 }) }],
        [1, { global_index: 1, modelMatrix: createModelMatrix({ scaleX: 20, translateX: 200, scaleY: 3, translateY: 7 }) }]
      ]),
      displayArray: [0, 1]
    };

    loraxState = {
      ...loraxState,
      compareMode: true,
      compareTreesResult: {
        comparisons: [
          {
            prev_idx: 0,
            next_idx: 1,
            inserted: [{ parent: 1, child: 2, parent_x: 0.1, parent_y: 0.2, child_x: 0.6, child_y: 0.9 }],
            removed: [{ parent: 3, child: 4, parent_x: 0.5, parent_y: 0.4, child_x: 0.9, child_y: 0.1 }]
          }
        ]
      }
    };

    render(<LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} />);

    expect(capturedRenderData).not.toBeNull();
    expect(capturedRenderData.compareEdgesData).toHaveLength(2);

    const inserted = capturedRenderData.compareEdgesData.find(
      (edge) => edge.color[0] === 0 && edge.color[1] === 255
    );
    const removed = capturedRenderData.compareEdgesData.find(
      (edge) => edge.color[0] === 255 && edge.color[1] === 0
    );

    expect(inserted.tree_idx).toBe(1);
    expectPathClose(inserted.pathLocal, [
      [0.1, 0.2],
      [0.6, 0.2],
      [0.6, 0.9]
    ]);
    expect(removed.tree_idx).toBe(0);
    expectPathClose(removed.pathLocal, [
      [0.5, 0.4],
      [0.9, 0.4],
      [0.9, 0.1]
    ]);
  });

  it('maps lineage paths from node x/y using canonical local transform', async () => {
    vi.useFakeTimers();

    loraxState = {
      ...loraxState,
      isConnected: true,
      selectedColorBy: 'group',
      metadataColors: { group: { A: [10, 20, 30, 255] } },
      searchTags: ['A'],
      displayLineagePaths: true,
      queryMultiValueSearch: vi.fn().mockResolvedValue({
        positions_by_value: {
          A: [{ node_id: 10, tree_idx: 0, x: 0.2, y: 0.4 }]
        },
        lineages: {
          A: {
            0: [{ path_node_ids: [10, 11] }]
          }
        },
        total_count: 1
      })
    };

    render(<LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(loraxState.queryMultiValueSearch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(capturedRenderData?.lineageData?.length).toBe(1);

    expect(capturedRenderData.lineageData[0].tree_idx).toBe(0);
    expectPathClose(capturedRenderData.lineageData[0].pathLocal, [
      [0.2, 0.4],
      [0.8, 0.4],
      [0.8, 0.9]
    ]);
  });
});
