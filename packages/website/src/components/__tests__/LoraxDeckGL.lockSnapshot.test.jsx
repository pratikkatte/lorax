/* @vitest-environment jsdom */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockInternalHandleViewStateChange = vi.fn();
const mockSetDeckSize = vi.fn();
const mockSetGenomicCoords = vi.fn();
const mockOnPolygonsAfterRender = vi.fn();
const mockUseTreeData = vi.hoisted(() => vi.fn());
const mockUseLocalData = vi.hoisted(() => vi.fn());

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

const mockLocalBins = new Map([
  [3, { global_index: 3, modelMatrix: createModelMatrix({ scaleX: 40, translateX: 0, scaleY: 2, translateY: 10 }) }],
  [9, { global_index: 9, modelMatrix: createModelMatrix({ scaleX: 40, translateX: 60, scaleY: 5, translateY: -20 }) }]
]);

let currentDisplayArray = [];
let currentLocalBins = mockLocalBins;

vi.mock('@deck.gl/react', async () => {
  const ReactMod = await import('react');
  return {
    default: ReactMod.forwardRef(({ children, onViewStateChange, onAfterRender }, ref) => {
      const deck = {
        getViewports: () => ([
          {
            id: 'ortho',
            width: 100,
            height: 50,
            unproject: ([x, y]) => [x, y, 0]
          }
        ]),
        canvas: { width: 100, height: 50, clientWidth: 100, clientHeight: 50 }
      };

      ReactMod.useImperativeHandle(ref, () => ({ deck }));

      return (
        <div>
          <button
            type="button"
            onClick={() => onViewStateChange?.({
              viewState: { ortho: { zoom: [5, 8], target: [0, 0] } },
              viewId: 'ortho',
              oldViewState: { zoom: [5, 8], target: [0, 0] }
            })}
          >
            view-change
          </button>
          <button type="button" onClick={() => onAfterRender?.()}>
            after-render
          </button>
          {children}
        </div>
      );
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
  useLorax: () => ({
    globalBpPerUnit: 1,
    genomeLength: 1000,
    tsconfig: { value: [0, 100], intervals: [0, 100, 200] },
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
  })
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
    handleViewStateChange: mockInternalHandleViewStateChange,
    decksize: { width: 100, height: 50 },
    setDecksize: mockSetDeckSize,
    xzoom: 5,
    yzoom: 8,
    viewReset: vi.fn(),
    fitYToBounds: vi.fn(),
    genomicCoords: [0, 100],
    setGenomicCoords: mockSetGenomicCoords,
    coordsReady: true
  })
}));

vi.mock('@lorax/core/src/hooks/useInterval.jsx', () => ({
  useInterval: () => ({
    visibleIntervals: [],
    allIntervalsInView: [0, 100],
    intervalBounds: { lo: 0, hi: 2 },
    intervalsCoords: [0, 100]
  })
}));

vi.mock('@lorax/core/src/hooks/useLocalData.jsx', () => ({
  useLocalData: (...args) => mockUseLocalData(...args)
}));

vi.mock('@lorax/core/src/hooks/useTreeData.jsx', () => ({
  useTreeData: (...args) => mockUseTreeData(...args)
}));

vi.mock('@lorax/core/src/hooks/useRenderData.jsx', () => ({
  useRenderData: () => ({
    renderData: null,
    isLoading: false
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
    onAfterRender: mockOnPolygonsAfterRender
  })
}));

vi.mock('@lorax/core/src/hooks/useDeckLayers.jsx', () => ({
  useDeckLayers: () => ({
    layers: [],
    layerFilter: null,
    clearHover: vi.fn()
  })
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

describe('LoraxDeckGL lock-view snapshot query payload', () => {
  let rafSpy;
  let cafSpy;
  let rafId;
  let rafQueue;

  const flushRaf = () => {
    const pending = Array.from(rafQueue.values());
    rafQueue.clear();
    pending.forEach((cb) => cb(0));
  };

  beforeEach(() => {
    currentDisplayArray = [];
    currentLocalBins = mockLocalBins;

    mockUseLocalData.mockReset();
    mockUseLocalData.mockImplementation(() => ({
      localBins: currentLocalBins,
      displayArray: currentDisplayArray,
      showingAllTrees: false
    }));

    mockUseTreeData.mockReset();
    mockUseTreeData.mockReturnValue({
      treeData: null,
      isLoading: false,
      error: null
    });

    rafId = 1;
    rafQueue = new Map();

    if (!globalThis.requestAnimationFrame) {
      globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 16);
    }
    if (!globalThis.cancelAnimationFrame) {
      globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
    }

    rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = rafId++;
      rafQueue.set(id, cb);
      return id;
    });
    cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
      rafQueue.delete(id);
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it('passes null lockView to useTreeData when lock is disabled', () => {
    render(
      <LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} lockModelMatrix={false} />
    );

    expect(mockUseTreeData).toHaveBeenCalled();
    const latestArgs = mockUseTreeData.mock.calls.at(-1)?.[0];
    expect(latestArgs.lockView).toBeNull();
  });

  it('updates lockView payload at most once per animation frame for repeated view updates', async () => {
    render(
      <LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} lockModelMatrix />
    );

    mockUseTreeData.mockClear();
    rafSpy.mockClear();

    const viewChangeButton = screen.getAllByRole('button', { name: 'view-change' }).at(-1);
    if (!viewChangeButton) {
      throw new Error('Missing view-change button');
    }
    fireEvent.click(viewChangeButton);
    fireEvent.click(viewChangeButton);

    expect(rafSpy).toHaveBeenCalledTimes(1);

    act(() => {
      flushRaf();
    });

    await waitFor(() => {
      const latestArgs = mockUseTreeData.mock.calls.at(-1)?.[0];
      expect(latestArgs.lockView).toMatchObject({
        boundingBox: { minX: 0, maxX: 100, minY: 0, maxY: 50, width: 100, height: 50 },
        inBoxTreeCount: 2,
        capturedAt: expect.any(Number)
      });
      expect(latestArgs.lockView.inBoxTreeIndices).toEqual([3, 9]);
      expect(latestArgs.lockView.adaptiveTarget).toBeNull();
    });
  });

  it('clears lockView payload on unlock', () => {
    const { rerender } = render(
      <LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} lockModelMatrix />
    );

    mockUseTreeData.mockClear();

    rerender(
      <LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} lockModelMatrix={false} />
    );

    expect(mockUseTreeData).toHaveBeenCalled();
    const latestArgs = mockUseTreeData.mock.calls.at(-1)?.[0];
    expect(latestArgs.lockView).toBeNull();
  });

  it('reports only blocking tree loading to callbacks during lock-refresh', () => {
    mockUseTreeData.mockReset();
    mockUseTreeData.mockReturnValue({
      treeData: null,
      isLoading: false,
      isBackgroundRefresh: true,
      fetchReason: 'lock-refresh',
      error: null
    });

    const onTreeLoadingChange = vi.fn();

    render(
      <LoraxDeckGL
        viewConfig={{ ortho: { enabled: true } }}
        lockModelMatrix
        onTreeLoadingChange={onTreeLoadingChange}
      />
    );

    expect(onTreeLoadingChange).toHaveBeenCalledWith(false);
    expect(onTreeLoadingChange).not.toHaveBeenCalledWith(true);
  });

  it('schedules lock snapshot recapture when displayArray changes while lock is enabled', () => {
    currentDisplayArray = [3];
    const { rerender } = render(
      <LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} lockModelMatrix />
    );

    rafSpy.mockClear();

    currentDisplayArray = [9];
    rerender(
      <LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} lockModelMatrix />
    );

    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it('sets adaptive target only when corner tree list has a single tree', async () => {
    const multiCornerBins = new Map([
      [1, { global_index: 1, modelMatrix: createModelMatrix({ scaleX: 40, translateX: 0, scaleY: 50, translateY: 0 }) }],
      [2, { global_index: 2, modelMatrix: createModelMatrix({ scaleX: 40, translateX: 60, scaleY: 50, translateY: 0 }) }]
    ]);
    const singleCornerBins = new Map([
      [2, { global_index: 2, modelMatrix: createModelMatrix({ scaleX: 20, translateX: 90, scaleY: 50, translateY: 0 }) }]
    ]);

    currentDisplayArray = [1, 2];
    currentLocalBins = multiCornerBins;

    const { rerender } = render(
      <LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} lockModelMatrix />
    );

    const trigger = () => {
      const viewChangeButton = screen.getAllByRole('button', { name: 'view-change' }).at(-1);
      if (!viewChangeButton) throw new Error('Missing view-change button');
      fireEvent.click(viewChangeButton);
      act(() => {
        flushRaf();
      });
    };

    mockUseTreeData.mockClear();
    trigger();
    await waitFor(() => {
      const latestArgs = mockUseTreeData.mock.calls.at(-1)?.[0];
      expect(latestArgs.lockView?.inBoxTreeIndices).toEqual([1, 2]);
      expect(latestArgs.lockView?.adaptiveTarget).toBeNull();
    });

    currentDisplayArray = [2];
    currentLocalBins = singleCornerBins;
    rerender(
      <LoraxDeckGL viewConfig={{ ortho: { enabled: true } }} lockModelMatrix />
    );
    trigger();
    await waitFor(() => {
      const latestArgs = mockUseTreeData.mock.calls.at(-1)?.[0];
      expect(latestArgs.lockView?.adaptiveTarget?.treeIndex).toBe(2);
      expect(latestArgs.lockView?.adaptiveTarget?.coverageX).toBeCloseTo(0.5);
      expect(latestArgs.lockView?.adaptiveTarget?.coverageArea).toBeCloseTo(0.5);
    });
  });
});
