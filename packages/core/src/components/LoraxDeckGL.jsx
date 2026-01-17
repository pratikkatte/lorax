import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
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
import { mergeWithDefaults, validateViewConfig, getEnabledViews } from '../utils/deckViewConfig.js';

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
  ...otherProps
}, ref) => {
  const deckRef = useRef(null);

  // 1. Merge and validate config
  const viewConfig = mergeWithDefaults(userViewConfig);
  validateViewConfig(viewConfig);
  const enabledViews = getEnabledViews(viewConfig);

  // 2. Controller setup (zoom axis and pan direction state)
  const { zoomAxis, panDirection } = useDeckController();

  // 3. Get config values from context for genomic coordinate conversion
  const { globalBpPerUnit, genomeLength, tsconfig, worker, workerConfigReady, queryTreeLayout, isConnected } = useLorax();

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
    displayArray
  });

  // Debug: Log viewport position vs tree coordinates
  useEffect(() => {
    if (renderData && viewState?.ortho) {
      const target = viewState.ortho.target;
      const zoom = viewState.ortho.zoom;
      console.log('[LoraxDeckGL] Viewport info:',
        'target:', target?.[0], target?.[1],
        'zoom:', zoom?.[0], zoom?.[1],
        'genomicCoords:', genomicCoords?.[0], '-', genomicCoords?.[1],
        'globalBpPerUnit:', globalBpPerUnit
      );
      // Trees are at X ~326741-458541 in world coords
      // Viewport target X should be in this range to see trees
      console.log('[LoraxDeckGL] Tree X range in world coords: ~326741 to 458541');
      console.log('[LoraxDeckGL] Viewport X center:', target?.[0], '- should be between 326741 and 458541');
    }
  }, [renderData, viewState, genomicCoords, globalBpPerUnit]);

  // 7. Compute genome position tick marks
  const genomePositions = useGenomePositions(genomicCoords);

  // 8. Layers for enabled views
  const { layers, layerFilter } = useDeckLayers({
    enabledViews,
    globalBpPerUnit,
    visibleIntervals,
    genomePositions,
    renderData
  });

  // 9. Event handlers - run internal logic first, then call external handlers
  const handleResize = useCallback(({ width, height }) => {
    setDecksize({ width, height });
    externalOnResize?.({ width, height });
  }, [setDecksize, externalOnResize]);

  const handleViewStateChange = useCallback((params) => {
    internalHandleViewStateChange(params);
    externalOnViewStateChange?.(params);
  }, [internalHandleViewStateChange, externalOnViewStateChange]);

  // 10. Ref forwarding - expose deck instance, viewState, and genomic coordinates
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
    treeDataError
  }), [viewState, views, viewReset, xzoom, yzoom, genomicCoords, setGenomicCoords, coordsReady, localBins, displayArray, showingAllTrees, treeData, treeDataLoading, treeDataError]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <DeckGL
        ref={deckRef}
        glOptions={glOptions}
        pickingRadius={pickingRadius}
        layers={layers}
        layerFilter={layerFilter}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        views={views}
        onResize={handleResize}
        {...otherProps}
      >
        {enabledViews.map(viewId => (
          <View key={viewId} id={viewId} />
        ))}
      </DeckGL>
    </div>
  );
});

LoraxDeckGL.displayName = 'LoraxDeckGL';

export default LoraxDeckGL;
