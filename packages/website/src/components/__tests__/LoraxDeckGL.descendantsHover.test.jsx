/* @vitest-environment jsdom */

import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let loraxState;
let localDataState;
let treeDataState;
let renderDataState;
let capturedRenderData;
let capturedDeckLayersArgs;

function createModelMatrix({ scaleX, translateX, scaleY = 1, translateY = 0 }) {
  const m = new Array(16).fill(0);
  m[0] = scaleX;
  m[5] = scaleY;
  m[12] = translateX;
  m[13] = translateY;
  return m;
}

vi.mock('@deck.gl/react', async () => {
  const ReactMod = await import('react');
  return {
    default: ReactMod.forwardRef(({ children }, ref) => {
      const deck = {
        getViewports: () => ([{ id: 'ortho', width: 100, height: 50, x: 0, y: 0, unproject: ([x, y]) => [x, y, 0] }]),
        canvas: { width: 100, height: 50, clientWidth: 100, clientHeight: 50 }
      };
      ReactMod.useImperativeHandle(ref, () => ({ deck }));
      return <div>{children}</div>;
    })
  };
});

vi.mock('@deck.gl/core', async () => {
  const ReactMod = await import('react');
  return { View: ({ children }) => <div>{children}</div> };
});

vi.mock('@lorax/core/src/context/LoraxProvider.jsx', () => ({
  useLorax: () => loraxState
}));

vi.mock('@lorax/core/src/hooks/useDeckController.jsx', () => ({
  useDeckController: () => ({ zoomAxis: 'all', panDirection: null, wheelPanDeltaX: 0 })
}));

vi.mock('@lorax/core/src/hooks/useDeckViews.jsx', () => ({
  useDeckViews: () => ({
    views: [{ id: 'ortho' }],
    viewState: { ortho: { zoom: [5, 8], target: [0, 0] }, 'tree-time': { zoom: [0, 8], target: [0, 0] } },
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

vi.mock('@lorax/core/src/hooks/useTreeViewportPipeline.jsx', () => ({
  useTreeViewportPipeline: () => ({
    interval: { visibleIntervals: [] },
    local: {
      localBins: localDataState.localBins,
      displayArray: localDataState.displayArray,
      showingAllTrees: localDataState.showingAllTrees
    },
    tree: {
      treeData: treeDataState.treeData,
      isLoading: false,
      isBackgroundRefresh: false,
      fetchReason: 'cache-only',
      error: null
    },
    render: { renderData: renderDataState.renderData, isLoading: false },
    visibleTreeIndices: localDataState.displayArray || [],
    treesInWindowCount: localDataState.displayArray?.length || 0
  })
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

vi.mock('@lorax/core/src/hooks/useLockViewSnapshot.jsx', () => ({
  useLockViewSnapshot: () => ({
    lockViewPayload: null,
    lockSnapshotDebugOverlay: null,
    scheduleCapture: vi.fn(),
    flushPendingCapture: vi.fn()
  }),
  LOCK_SNAPSHOT_DEBUG_LABEL_BY_CORNER: {},
  formatLockSnapshotDebugCoordinate: (v) => String(v)
}));

vi.mock('@lorax/core/src/hooks/useDeckLayers.jsx', () => ({
  useDeckLayers: (args) => {
    capturedDeckLayersArgs = args;
    capturedRenderData = args.renderData;
    return { layers: [], layerFilter: null, clearHover: vi.fn() };
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

describe('LoraxDeckGL descendant hover overlays', () => {
  beforeEach(() => {
    capturedRenderData = null;
    capturedDeckLayersArgs = null;
    loraxState = {
      globalBpPerUnit: 1,
      genomeLength: 1000,
      tsconfig: { value: [0, 100], intervals: [0, 100] },
      intervalWorker: null,
      localDataWorker: null,
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
        [0, { global_index: 0, modelMatrix: createModelMatrix({ scaleX: 10, translateX: 100, scaleY: 2, translateY: 5 }) }],
        [1, { global_index: 1, modelMatrix: createModelMatrix({ scaleX: 20, translateX: 200, scaleY: 3, translateY: 7 }) }]
      ]),
      displayArray: [0, 1],
      showingAllTrees: false
    };
    treeDataState = { treeData: { node_id: [], parent_id: [], is_tip: [], tree_idx: [], x: [], y: [] } };
    renderDataState = {
      renderData: {
        pathPositions: new Float64Array([
          0, 0, 1, 0, 1, 1,
          1, 1, 2, 1, 2, 2,
          10, 0, 11, 0, 11, 1,
          11, 1, 12, 1, 12, 2
        ]),
        pathStartIndices: new Uint32Array([0, 3, 6, 9, 12]),
        tipPositions: new Float64Array(0),
        tipColors: new Uint8Array(0),
        edgeData: [
          { tree_idx: 0, parent_id: 7, child_id: 9 },
          { tree_idx: 0, parent_id: 9, child_id: 12 },
          { tree_idx: 1, parent_id: 4, child_id: 9 },
          { tree_idx: 1, parent_id: 9, child_id: 15 }
        ],
        edgeCount: 4,
        tipCount: 0,
        tipData: [
          { tree_idx: 0, node_id: 12, position: [2, 2] },
          { tree_idx: 1, node_id: 15, position: [12, 2] },
          { tree_idx: 1, node_id: 99, position: [15, 3] }
        ],
        mutPositions: new Float64Array(0),
        mutCount: 0
      }
    };
  });

  it('computes descendant overlays across visible trees when enabled', async () => {
    render(<LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} highlightDescendantsOnHover />);
    await act(async () => {
      capturedDeckLayersArgs.onEdgeHover?.({ tree_idx: 0, parent_id: 7, child_id: 9 }, { index: 0 }, null);
    });

    expect(capturedRenderData.descendantEdgeIndices).toEqual([1, 3]);
    const descendantTips = (capturedRenderData.highlightData || []).filter(
      (item) => item?.color?.[0] === 56 && item?.color?.[1] === 189 && item?.color?.[2] === 248
    );
    expect(descendantTips.map((item) => item.node_id).sort((a, b) => a - b)).toEqual([12, 15]);
  });

  it('adds raw node time to tip hover payloads', async () => {
    const onTipHover = vi.fn();
    treeDataState = {
      treeData: {
        node_id: [12],
        parent_id: [-1],
        is_tip: [true],
        tree_idx: [0],
        x: [0.5],
        y: [0.75],
        time: [42],
        global_min_time: 0,
        global_max_time: 100
      }
    };

    render(<LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} onTipHover={onTipHover} />);

    await act(async () => {
      capturedDeckLayersArgs.onTipHover?.({ tree_idx: 0, node_id: 12, position: [1, 2] }, { index: 0 }, null);
    });

    expect(onTipHover).toHaveBeenCalledWith(
      expect.objectContaining({ tree_idx: 0, node_id: 12, node_time: 42 }),
      expect.any(Object),
      null
    );
  });

  it('adds parent and child raw times to edge hover payloads using the active time scale', async () => {
    const onEdgeHover = vi.fn();
    const childTime = 9;
    const childY = 1 - Math.log1p(childTime) / Math.log1p(100);
    treeDataState = {
      treeData: {
        node_id: [7, 9],
        parent_id: [-1, 7],
        is_tip: [false, false],
        tree_idx: [0, 0],
        x: [0.2, 0.8],
        y: [1, childY],
        time: [],
        global_min_time: 0,
        global_max_time: 100
      }
    };

    render(<LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} timeScale="log" onEdgeHover={onEdgeHover} />);

    await act(async () => {
      capturedDeckLayersArgs.onEdgeHover?.({ tree_idx: 0, parent_id: 7, child_id: 9 }, { index: 0 }, null);
    });

    const [edgePayload, infoPayload, eventPayload] = onEdgeHover.mock.calls[0];
    expect(edgePayload).toMatchObject({
      tree_idx: 0,
      parent_id: 7,
      child_id: 9,
      parent_time: 0
    });
    expect(edgePayload.child_time).toBeCloseTo(childTime, 6);
    expect(infoPayload).toEqual(expect.any(Object));
    expect(eventPayload).toBeNull();
  });

  it('clears descendant overlays when hover clears', async () => {
    render(<LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} highlightDescendantsOnHover />);
    await act(async () => {
      capturedDeckLayersArgs.onEdgeHover?.({ tree_idx: 0, parent_id: 7, child_id: 9 }, { index: 0 }, null);
    });
    expect(capturedRenderData.descendantEdgeIndices).toEqual([1, 3]);

    await act(async () => {
      capturedDeckLayersArgs.onEdgeHover?.(null, null, null);
    });
    expect(capturedRenderData.descendantEdgeIndices).toBeUndefined();
    const descendantTips = (capturedRenderData.highlightData || []).filter(
      (item) => item?.color?.[0] === 56 && item?.color?.[1] === 189 && item?.color?.[2] === 248
    );
    expect(descendantTips).toHaveLength(0);
  });

  it('does not compute descendant overlays when disabled', async () => {
    render(<LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} />);
    await act(async () => {
      capturedDeckLayersArgs.onEdgeHover?.({ tree_idx: 0, parent_id: 7, child_id: 9 }, { index: 0 }, null);
    });

    expect(capturedRenderData.descendantEdgeIndices).toBeUndefined();
    const descendantTips = (capturedRenderData.highlightData || []).filter(
      (item) => item?.color?.[0] === 56 && item?.color?.[1] === 189 && item?.color?.[2] === 248
    );
    expect(descendantTips).toHaveLength(0);
  });

  it('uses configured descendant highlight color for tips and edge overlay', async () => {
    render(
      <LoraxDeckGL
        viewConfig={{ ortho: { enabled: true } }}
        highlightDescendantsOnHover
        descendantsHighlightColor={[255, 0, 0, 255]}
      />
    );
    await act(async () => {
      capturedDeckLayersArgs.onEdgeHover?.({ tree_idx: 0, parent_id: 7, child_id: 9 }, { index: 0 }, null);
    });

    const descendantTips = (capturedRenderData.highlightData || []).filter((item) => item?.node_id === 12 || item?.node_id === 15);
    expect(descendantTips).toHaveLength(2);
    expect(descendantTips.every((item) => item.color[0] === 255 && item.color[1] === 0 && item.color[2] === 0)).toBe(true);
    expect(capturedDeckLayersArgs.descendantEdgeColor).toEqual([255, 0, 0, 255]);
  });
});
