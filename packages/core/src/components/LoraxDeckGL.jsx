import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { View } from '@deck.gl/core';
import { useLorax } from '../context/LoraxProvider.jsx';
import { useDeckViews } from '../hooks/useDeckViews.jsx';
import { useDeckLayers } from '../hooks/useDeckLayers.jsx';
import { useDeckController } from '../hooks/useDeckController.jsx';
import { useInterval } from '../hooks/useInterval.jsx';
import { useLocalData } from '../hooks/useLocalData.jsx';
import { useTreeData } from '../hooks/useTreeData.jsx';
import { useRenderData } from '../hooks/useRenderData.jsx';
import { useGenomePositions } from '../hooks/useGenomePositions.jsx';
import { useTreePolygons } from '../hooks/useTreePolygons.jsx';
import TreePolygonOverlay from './TreePolygonOverlay.jsx';
import { mergeWithDefaults, validateViewConfig, getEnabledViews } from '../utils/deckViewConfig.js';

function pointInPolygon(point, vs) {
  // Ray-casting algorithm: point = [x,y], vs = [[x,y], ...]
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function findPolygonAtPoint(polygons, x, y) {
  if (!Array.isArray(polygons) || polygons.length === 0) return null;
  // Iterate in reverse so later polygons (visually “on top”) win.
  for (let i = polygons.length - 1; i >= 0; i--) {
    const p = polygons[i];
    if (p?.vertices && p.vertices.length >= 3 && pointInPolygon([x, y], p.vertices)) {
      return p;
    }
  }
  return null;
}

/**
 * LoraxDeckGL - Configurable deck.gl component with 4 views:
 * - ortho: Main tree visualization (always required)
 * - genomeInfo: Tree interval markers (optional)
 * - genomePositions: Coordinate labels (optional)
 * - treeTime: Time axis (optional)
 *
 * @param {Object} props
 * @param {Object} props.viewConfig - View configuration (dimensions and enabled state)
 * @param {Function} props.onViewStateChange - External view state change handler
 * @param {Function} props.onResize - Deck resize handler
 * @param {Function} props.onGenomicCoordsChange - Callback when genomic coordinates change ([startBp, endBp])
 * @param {number} props.pickingRadius - Picking radius in pixels (default: 10)
 * @param {Object} props.glOptions - WebGL context options
 * @param {React.Ref} ref - Forward ref to access deck instance and viewState
 */
const LoraxDeckGL = forwardRef(({
  viewConfig: userViewConfig,
  onViewStateChange: externalOnViewStateChange,
  onResize: externalOnResize,
  onGenomicCoordsChange: externalOnGenomicCoordsChange,
  pickingRadius = 10,
  glOptions = { preserveDrawingBuffer: true },
  // Polygon overlay props
  showPolygons = true,
  polygonOptions = {},
  onPolygonHover,
  onPolygonClick,
  // Tree interaction callbacks (UI lives in packages/website)
  onTipHover,
  onTipClick,
  onEdgeHover,
  onEdgeClick,
  ...otherProps
}, ref) => {
  const deckRef = useRef(null);

  // 1. Merge and validate config
  const viewConfig = mergeWithDefaults(userViewConfig);
  validateViewConfig(viewConfig);
  const enabledViews = getEnabledViews(viewConfig);

  // 2. Controller setup (zoom axis and pan direction state)
  const { zoomAxis, panDirection } = useDeckController();

  // 3. Get config + filter values from context
  const {
    globalBpPerUnit,
    genomeLength,
    tsconfig,
    worker,
    workerConfigReady,
    queryTreeLayout,
    isConnected,
    // Metadata + filter (when enableMetadataFilter=true)
    metadataArrays,
    metadataColors,
    selectedColorBy,
    enabledValues
  } = useLorax();

  // Stabilize population filter to avoid rerunning downstream effects every render
  const populationFilter = useMemo(() => {
    if (!selectedColorBy) return null;
    return {
      colorBy: selectedColorBy,
      enabledValues: Array.from(enabledValues || [])
    };
  }, [selectedColorBy, enabledValues]);

  // 4. Views and view state management (with genomic coordinates)
  const {
    views,
    viewState,
    handleViewStateChange: internalHandleViewStateChange,
    setDecksize,
    xzoom,
    yzoom,
    viewReset,
    // Genomic coordinates
    genomicCoords,
    setGenomicCoords,
    coordsReady
  } = useDeckViews({
    viewConfig,
    enabledViews,
    zoomAxis,
    panDirection,
    globalBpPerUnit,
    genomeLength,
    tsconfigValue: tsconfig?.value
  });

  // 5. Notify parent when genomicCoords changes
  useEffect(() => {
    if (genomicCoords && externalOnGenomicCoordsChange) {
      externalOnGenomicCoordsChange(genomicCoords);
    }
  }, [genomicCoords, externalOnGenomicCoordsChange]);

  // 6. Worker-based interval computation
  const { visibleIntervals, allIntervalsInView, intervalBounds } = useInterval({
    worker,
    workerConfigReady,
    genomicCoords
  });

  // 6b. Worker-based local data computation (tree positioning)
  const { localBins, displayArray, showingAllTrees } = useLocalData({
    worker,
    workerConfigReady,
    allIntervalsInView,
    intervalBounds,  // { lo, hi } global index bounds
    genomicCoords,
    viewState,
    tsconfig,  // Pass full tsconfig (has genome_length, intervals)
    displayOptions: { selectionStrategy: 'largestSpan' }
  });

  // 6c. Fetch tree data from backend (auto-triggers on displayArray change)
  const { treeData, isLoading: treeDataLoading, error: treeDataError } = useTreeData({
    displayArray,
    queryTreeLayout,
    isConnected,
    sparsityOptions: { precision: 2 }
  });

  // 6d. Compute render data (typed arrays) for tree visualization
  const { renderData, isLoading: renderDataLoading } = useRenderData({
    localBins,
    treeData,
    displayArray,
    // Metadata-driven tip coloring
    metadataArrays,
    metadataColors,
    populationFilter
  });

  // 7. Compute genome position tick marks
  const genomePositions = useGenomePositions(genomicCoords);

  // 8. Layers for enabled views
  const { layers, layerFilter } = useDeckLayers({
    enabledViews,
    globalBpPerUnit,
    visibleIntervals,
    genomePositions,
    renderData,
    // Tree interactions
    onTipHover,
    onTipClick,
    onEdgeHover,
    onEdgeClick
  });

  // 9. Tree polygon overlay computation and animation
  const {
    polygons,
    hoveredPolygon,
    setHoveredPolygon,
    isReady: polygonsReady,
    _cacheViewports
  } = useTreePolygons({
    localBins,
    globalBpPerUnit,
    viewState,
    enabled: showPolygons,
    animate: polygonOptions?.animate ?? true,
    animationDuration: polygonOptions?.animationDuration ?? 300,
    easing: polygonOptions?.easing ?? 'easeOut',
    onPolygonHover,
    onPolygonClick
  });

  // 10. Event handlers - run internal logic first, then call external handlers
  const handleResize = useCallback(({ width, height }) => {
    setDecksize({ width, height });
    externalOnResize?.({ width, height });
  }, [setDecksize, externalOnResize]);

  const handleViewStateChange = useCallback((params) => {
    internalHandleViewStateChange(params);
    externalOnViewStateChange?.(params);
  }, [internalHandleViewStateChange, externalOnViewStateChange]);

  const handleAfterRender = useCallback(() => {
    if (showPolygons && _cacheViewports && deckRef.current?.deck) {
      _cacheViewports(deckRef.current.deck);
    }
  }, [showPolygons, _cacheViewports]);

  // Enable deck.gl picking loop for layer-level onHover/onClick and
  // implement polygon hover/click without letting the SVG overlay intercept pointer events.
  const handleDeckHover = useCallback((info) => {
    if (!showPolygons) return;
    // Only do polygon hover when nothing pickable is hovered.
    if (info?.object) return;
    const x = info?.x;
    const y = info?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const hit = findPolygonAtPoint(polygons, x, y);
    setHoveredPolygon(hit?.key ?? null);
  }, [showPolygons, polygons, setHoveredPolygon]);

  const handleDeckClick = useCallback((info) => {
    if (!showPolygons) return;
    // If a deck object was picked, its layer handler should handle it.
    if (info?.object) return;
    const x = info?.x;
    const y = info?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const hit = findPolygonAtPoint(polygons, x, y);
    if (hit?.treeIndex != null) {
      onPolygonClick?.({ key: hit.key, treeIndex: hit.treeIndex, polygon: hit });
    }
  }, [showPolygons, polygons, onPolygonClick]);

  // 11. Ref forwarding - expose deck instance, viewState, and genomic coordinates
  useImperativeHandle(ref, () => ({
    getDeck: () => deckRef.current?.deck,
    getViewState: () => viewState,
    getViews: () => views,
    viewReset,
    xzoom,
    yzoom,
    // Genomic coordinates
    genomicCoords,
    setGenomicCoords,
    coordsReady,
    // Local data for tree visualization
    localBins,
    displayArray,
    showingAllTrees,
    // Tree data from backend
    treeData,
    treeDataLoading,
    treeDataError,
    // Polygon overlay state
    polygons,
    hoveredPolygon,
    setHoveredPolygon,
    polygonsReady
  }), [viewState, views, viewReset, xzoom, yzoom, genomicCoords, setGenomicCoords, coordsReady, localBins, displayArray, showingAllTrees, treeData, treeDataLoading, treeDataError, polygons, hoveredPolygon, setHoveredPolygon, polygonsReady]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <DeckGL
        ref={deckRef}
        glOptions={glOptions}
        pickingRadius={pickingRadius}
        layers={layers}
        layerFilter={layerFilter}
        viewState={viewState}
        onHover={handleDeckHover}
        onClick={handleDeckClick}
        onViewStateChange={handleViewStateChange}
        views={views}
        onResize={handleResize}
        onAfterRender={handleAfterRender}
        {...otherProps}
      >
        {enabledViews.map(viewId => (
          <View key={viewId} id={viewId}>
            {viewId === 'ortho' && showPolygons && (
              <TreePolygonOverlay
                polygons={polygons}
                fillColor={polygonOptions?.fillColor}
                hoverFillColor={polygonOptions?.hoverFillColor}
                strokeColor={polygonOptions?.strokeColor}
                strokeWidth={polygonOptions?.strokeWidth}
                enableTransitions={polygonOptions?.enableTransitions}
                onHover={setHoveredPolygon}
                onClick={onPolygonClick}
              />
            )}
          </View>
        ))}
      </DeckGL>
    </div>
  );
});

LoraxDeckGL.displayName = 'LoraxDeckGL';

export default LoraxDeckGL;
