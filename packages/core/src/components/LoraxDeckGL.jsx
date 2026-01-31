import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect, useMemo, useState } from 'react';
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
import { useTimePositions } from '../hooks/useTimePositions.jsx';
import { useTreePolygons } from '../hooks/useTreePolygons.jsx';
import TreePolygonOverlay from './TreePolygonOverlay.jsx';
import { mergeWithDefaults, validateViewConfig, getEnabledViews } from '../utils/deckViewConfig.js';
import { getSVG } from '../utils/deckglToSvg.js';

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

function getCanvasXYFromDeckEvent(deckRef, info, event) {
  // Prefer deck.gl-provided canvas coords when available.
  const ix = info?.x;
  const iy = info?.y;
  if (Number.isFinite(ix) && Number.isFinite(iy)) return { x: ix, y: iy };

  const src = event?.srcEvent;
  // offsetX/offsetY are already relative to the event target (typically the canvas).
  const ox = src?.offsetX;
  const oy = src?.offsetY;
  if (Number.isFinite(ox) && Number.isFinite(oy)) return { x: ox, y: oy };

  // Fall back to clientX/clientY relative to the deck canvas rect.
  const cx = src?.clientX;
  const cy = src?.clientY;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const canvas = deckRef?.current?.deck?.canvas;
  const rect = canvas?.getBoundingClientRect?.();
  if (!rect) return null;
  return { x: cx - rect.left, y: cy - rect.top };
}

function getOrthoLocalXY(deckRef, info, event) {
  const canvasXY = getCanvasXYFromDeckEvent(deckRef, info, event);
  if (!canvasXY) return null;

  // Polygons are rendered inside the `ortho` <View>, so their vertices are in
  // ortho-viewport-local pixel coordinates. Convert from canvas to ortho-local.
  const vp = info?.viewport;
  if (vp?.id && vp.id !== 'ortho') return null;
  const vx = vp?.x ?? 0;
  const vy = vp?.y ?? 0;
  return { x: canvasXY.x - vx, y: canvasXY.y - vy };
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
  // Tree loading state callback
  onTreeLoadingChange,
  // Visible trees change callback
  onVisibleTreesChange,
  // External control of polygon hover (for list-to-polygon sync)
  hoveredTreeIndex,
  // Optional: per-tree edge coloring (CSV "color by tree")
  colorEdgesByTree = false,
  treeEdgeColors = null,
  // Optional: node id to highlight (e.g. mutation click)
  highlightedMutationNode = null,
  // Optional: tree index to restrict mutation highlight to (e.g. Info→Mutations click)
  highlightedMutationTreeIndex = null,
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
    queryHighlightPositions,
    queryMultiValueSearch,
    isConnected,
    // Metadata + filter (when enableMetadataFilter=true)
    metadataArrays,
    metadataColors,
    selectedColorBy,
    enabledValues,
    highlightedMetadataValue,
    searchTags,  // Multi-value search tags
    displayLineagePaths  // Lineage display toggle
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
    decksize,
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

  // Get visible tree indices from localBins (needed for useTreeData and highlight fetching)
  const visibleTreeIndices = useMemo(() => {
    if (!localBins) return [];
    return Array.from(localBins.keys());
  }, [localBins]);

  // 6c. Fetch tree data from backend (auto-triggers on displayArray change)
  // Uses frontend caching to avoid re-fetching already loaded trees
  const { treeData, isLoading: treeDataLoading, error: treeDataError } = useTreeData({
    displayArray,
    queryTreeLayout,
    isConnected,
    sparsification: displayArray.length > 1,  // Enable to reduce data transfer for large trees
    tsconfig,  // For cache invalidation on file change
    genomicCoords,  // For viewport-based cache eviction
  });

  // 6c.1. Notify parent when tree loading state changes
  useEffect(() => {
    onTreeLoadingChange?.(treeDataLoading);
  }, [treeDataLoading, onTreeLoadingChange]);

  // 6c.2. Notify parent when visible trees (displayArray) changes
  useEffect(() => {
    if (displayArray && onVisibleTreesChange) {
      onVisibleTreesChange(displayArray);
    }
  }, [displayArray, onVisibleTreesChange]);

  // 6d. Compute render data (typed arrays) for tree visualization
  const { renderData: baseRenderData, isLoading: renderDataLoading } = useRenderData({
    localBins,
    treeData,
    displayArray,
    // Metadata-driven tip coloring
    metadataArrays,
    metadataColors,
    populationFilter
  });

  // 6e. Highlight positions for filter-table clicks
  const [highlightPositions, setHighlightPositions] = useState(null);
  const highlightRequestRef = useRef(0);
  const highlightDebounceRef = useRef(null);

  // Fetch highlight positions when highlighted value or visible trees change
  useEffect(() => {
    // Clear any pending debounced request
    if (highlightDebounceRef.current) {
      clearTimeout(highlightDebounceRef.current);
      highlightDebounceRef.current = null;
    }

    if (!highlightedMetadataValue || !selectedColorBy || visibleTreeIndices.length === 0) {
      setHighlightPositions(null);
      return;
    }

    if (!queryHighlightPositions || !isConnected) {
      return;
    }

    // Debounce the request to avoid excessive calls during panning/zooming
    highlightDebounceRef.current = setTimeout(() => {
      // Track this request to avoid race conditions
      const requestId = ++highlightRequestRef.current;

      console.log('[LoraxDeckGL] Fetching highlight positions for', visibleTreeIndices.length, 'trees');
      queryHighlightPositions(selectedColorBy, highlightedMetadataValue, visibleTreeIndices)
        .then(result => {
          // Ignore stale responses
          if (requestId !== highlightRequestRef.current) return;
          setHighlightPositions(result.positions || []);
        })
        .catch(err => {
          if (requestId !== highlightRequestRef.current) return;
          console.error('Failed to fetch highlight positions:', err);
          setHighlightPositions(null);
        });
    }, 150); // 150ms debounce

    return () => {
      if (highlightDebounceRef.current) {
        clearTimeout(highlightDebounceRef.current);
      }
    };
  }, [highlightedMetadataValue, selectedColorBy, visibleTreeIndices, queryHighlightPositions, isConnected]);

  // Compute highlight data with world coordinates by applying model matrices
  const computedHighlightData = useMemo(() => {
    if (!highlightPositions || !localBins || highlightPositions.length === 0) {
      return [];
    }

    // Get color for highlighted value from metadataColors
    const color = metadataColors?.[selectedColorBy]?.[highlightedMetadataValue]
      || [255, 200, 0, 255];

    return highlightPositions
      .map(pos => {
        const bin = localBins.get(pos.tree_idx);
        if (!bin?.modelMatrix) return null;

        const m = bin.modelMatrix;
        // Model matrix format: column-major 4x4
        // m[0] = scaleX, m[5] = scaleY, m[12] = translateX, m[13] = translateY
        const scaleX = m[0];
        const scaleY = m[5];
        const translateX = m[12];
        const translateY = m[13];

        // Apply model matrix transform: worldPos = scale * localPos + translate
        const worldX = pos.x * scaleX + translateX;
        const worldY = pos.y * scaleY + translateY;

        return {
          position: [worldX, worldY],
          color,
          node_id: pos.node_id,
          tree_idx: pos.tree_idx
        };
      })
      .filter(Boolean);
  }, [highlightPositions, localBins, metadataColors, highlightedMetadataValue, selectedColorBy]);

  // 6f. Multi-value highlight positions for searchTags (OR logic, per-value colors)
  const [multiHighlightData, setMultiHighlightData] = useState(null);
  const multiHighlightRequestRef = useRef(0);
  const multiHighlightDebounceRef = useRef(null);

  // Fetch multi-value highlight positions when searchTags or visible trees change
  useEffect(() => {
    // Clear any pending debounced request
    if (multiHighlightDebounceRef.current) {
      clearTimeout(multiHighlightDebounceRef.current);
      multiHighlightDebounceRef.current = null;
    }

    // If no searchTags or key, clear highlights
    if (!searchTags || searchTags.length === 0 || !selectedColorBy || visibleTreeIndices.length === 0) {
      setMultiHighlightData(null);
      return;
    }

    if (!queryMultiValueSearch || !isConnected) {
      return;
    }

    // Debounce the request to avoid excessive calls during panning/zooming
    multiHighlightDebounceRef.current = setTimeout(() => {
      // Track this request to avoid race conditions
      const requestId = ++multiHighlightRequestRef.current;

      console.log('[LoraxDeckGL] Fetching multi-value highlight positions for', searchTags.length, 'values,', visibleTreeIndices.length, 'trees');

      queryMultiValueSearch(selectedColorBy, searchTags, visibleTreeIndices, displayLineagePaths)
        .then(result => {
          // Ignore stale responses
          if (requestId !== multiHighlightRequestRef.current) return;
          setMultiHighlightData(result);
        })
        .catch(err => {
          if (requestId !== multiHighlightRequestRef.current) return;
          console.error('Failed to fetch multi-value highlight positions:', err);
          setMultiHighlightData(null);
        });
    }, 150); // 150ms debounce

    return () => {
      if (multiHighlightDebounceRef.current) {
        clearTimeout(multiHighlightDebounceRef.current);
      }
    };
  }, [searchTags, selectedColorBy, visibleTreeIndices, queryMultiValueSearch, isConnected, displayLineagePaths]);

  // Compute multi-highlight data with world coordinates and per-value colors
  const computedMultiHighlightData = useMemo(() => {
    if (!multiHighlightData?.positions_by_value || !localBins) {
      return [];
    }

    const positions = [];
    const valueToColor = metadataColors?.[selectedColorBy] || {};

    for (const [value, valuePositions] of Object.entries(multiHighlightData.positions_by_value)) {
      // Get color for this value from metadataColors, or use default
      const color = valueToColor[value] || [255, 200, 0, 255];

      for (const pos of valuePositions) {
        const bin = localBins.get(pos.tree_idx);
        if (!bin?.modelMatrix) continue;

        const m = bin.modelMatrix;
        // Model matrix format: column-major 4x4
        const scaleX = m[0];
        const scaleY = m[5];
        const translateX = m[12];
        const translateY = m[13];

        // Apply model matrix transform
        const worldX = pos.x * scaleX + translateX;
        const worldY = pos.y * scaleY + translateY;

        positions.push({
          position: [worldX, worldY],
          color,
          node_id: pos.node_id,
          tree_idx: pos.tree_idx,
          value  // Include value for debugging/inspection
        });
      }
    }
    return positions;
  }, [multiHighlightData, localBins, metadataColors, selectedColorBy]);

  // Compute mutation highlight data from a selected node id.
  // We compute positions directly from currently loaded `treeData` (visible trees),
  // applying the same transform as the render worker uses for mutation markers.
  const computedMutationHighlightData = useMemo(() => {
    const raw = highlightedMutationNode;
    if (raw === null || raw === undefined || raw === '') return [];
    if (!treeData?.mut_node_id || !treeData?.mut_tree_idx || !treeData?.mut_x || !treeData?.mut_y) return [];
    if (!localBins || !(localBins instanceof Map)) return [];

    const nodeId = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(nodeId)) return [];

    const selectedTreeIdxRaw = highlightedMutationTreeIndex;
    const selectedTreeIdx = (selectedTreeIdxRaw === null || selectedTreeIdxRaw === undefined || selectedTreeIdxRaw === '')
      ? null
      : Number.parseInt(String(selectedTreeIdxRaw), 10);
    if (selectedTreeIdxRaw != null && selectedTreeIdx === null) return [];
    if (selectedTreeIdx != null && !Number.isFinite(selectedTreeIdx)) return [];

    const out = [];
    const defaultColor = [255, 0, 0, 255];
    const defaultRadius = 7;

    // Use mutation marker coordinates (mutations are not sparsified, unlike nodes).
    // `mut_x` is normalized time (vertical), `mut_y` is normalized layout (horizontal, backend-swapped).
    // World X for mutation markers = mut_y * scaleX + translateX; World Y = mut_x.
    const n = Math.min(
      treeData.mut_node_id.length,
      treeData.mut_tree_idx.length,
      treeData.mut_x.length,
      treeData.mut_y.length
    );
    for (let i = 0; i < n; i++) {
      if (treeData.mut_node_id[i] !== nodeId) continue;

      const treeIdx = treeData.mut_tree_idx[i];
      if (selectedTreeIdx != null && treeIdx !== selectedTreeIdx) continue;
      const bin = localBins.get(treeIdx);
      if (!bin?.modelMatrix) continue;

      const m = bin.modelMatrix;
      const scaleX = m[0];
      const translateX = m[12];

      const time = treeData.mut_x[i];
      const layout = treeData.mut_y[i];
      if (!Number.isFinite(time) || !Number.isFinite(layout)) continue;

      const worldX = layout * scaleX + translateX;
      const worldY = time;

      out.push({
        position: [worldX, worldY],
        color: defaultColor,
        radius: defaultRadius,
        node_id: nodeId,
        tree_idx: treeIdx
      });

      // Only highlight a single marker for the clicked mutation.
      break;
    }

    return out;
  }, [highlightedMutationNode, highlightedMutationTreeIndex, treeData, localBins]);

  // Build nodePositions lookup from treeData for lineage path rendering
  const nodePositionsLookup = useMemo(() => {
    if (!treeData?.node_id) return new Map();

    // Map<tree_idx, Map<node_id, {x, y}>>
    const lookup = new Map();
    for (let i = 0; i < treeData.node_id.length; i++) {
      const treeIdx = treeData.tree_idx[i];
      if (!lookup.has(treeIdx)) {
        lookup.set(treeIdx, new Map());
      }
      lookup.get(treeIdx).set(treeData.node_id[i], {
        x: treeData.x[i],
        y: treeData.y[i]
      });
    }
    return lookup;
  }, [treeData]);

  // Compute lineage path data when displayLineagePaths is enabled
  const computedLineageData = useMemo(() => {
    if (!displayLineagePaths || !multiHighlightData?.lineages || !localBins || nodePositionsLookup.size === 0) {
      return [];
    }

    const lineages = [];
    const valueToColor = metadataColors?.[selectedColorBy] || {};

    for (const [value, treeLineages] of Object.entries(multiHighlightData.lineages)) {
      // Get color for this value, or use lineage-specific color if provided
      const defaultColor = valueToColor[value] || [255, 200, 0, 255];

      for (const [treeIdxStr, pathsForTree] of Object.entries(treeLineages)) {
        const treeIdx = parseInt(treeIdxStr, 10);
        const bin = localBins.get(treeIdx);
        if (!bin?.modelMatrix) continue;

        const nodePositions = nodePositionsLookup.get(treeIdx);
        if (!nodePositions) continue;

        const m = bin.modelMatrix;
        const scaleX = m[0];
        const scaleY = m[5];
        const translateX = m[12];
        const translateY = m[13];

        for (const lineage of pathsForTree) {
          const pathNodeIds = lineage.path_node_ids;
          if (!pathNodeIds || pathNodeIds.length < 2) continue;

          // Use lineage-specific color if provided, otherwise use value color
          const lineageColor = lineage.color || defaultColor;

          // Build L-shaped path coordinates
          // For each consecutive pair of nodes, create horizontal-then-vertical path
          const pathCoords = [];

          for (let i = 0; i < pathNodeIds.length; i++) {
            const nodeId = pathNodeIds[i];
            // Look up node position from treeData
            const nodePos = nodePositions.get(nodeId);
            if (!nodePos) continue;

            // Apply model matrix transform
            // In tree coordinates: y is horizontal (genomic/time), x is vertical (layout)
            // worldX = nodePos.y * scaleX + translateX (horizontal position)
            // worldY = nodePos.x * scaleY + translateY (vertical position)
            const worldX = nodePos.y * scaleX + translateX;
            const worldY = nodePos.x * scaleY + translateY;

            if (i > 0 && pathCoords.length > 0) {
              // Insert L-shaped corner: horizontal then vertical
              const prevCoord = pathCoords[pathCoords.length - 1];
              // Move horizontally first (same Y as previous), then vertically to current
              pathCoords.push([worldX, prevCoord[1]]);
            }
            pathCoords.push([worldX, worldY]);
          }

          if (pathCoords.length >= 2) {
            lineages.push({
              path: pathCoords,
              color: lineageColor,
              treeIdx,
              value
            });
          }
        }
      }
    }

    return lineages;
  }, [displayLineagePaths, multiHighlightData, localBins, nodePositionsLookup, metadataColors, selectedColorBy]);

  // Merge highlight data into render data
  // Multi-value search takes priority over single-value highlight
  const renderData = useMemo(() => {
    if (!baseRenderData) return null;

    const result = { ...baseRenderData };
    const mergedHighlights = [];

    // Multi-value search (searchTags) takes priority over single-value highlight
    if (computedMultiHighlightData && computedMultiHighlightData.length > 0) {
      mergedHighlights.push(...computedMultiHighlightData);
    } else if (computedHighlightData && computedHighlightData.length > 0) {
      // Fall back to single-value highlight
      mergedHighlights.push(...computedHighlightData);
    }

    // Append node-based mutation highlight (from Info click).
    if (computedMutationHighlightData && computedMutationHighlightData.length > 0) {
      mergedHighlights.push(...computedMutationHighlightData);
    }

    if (mergedHighlights.length > 0) {
      result.highlightData = mergedHighlights;
    }

    // Add lineage data when enabled
    if (computedLineageData && computedLineageData.length > 0) {
      result.lineageData = computedLineageData;
    }

    return result;
  }, [baseRenderData, computedHighlightData, computedMultiHighlightData, computedMutationHighlightData, computedLineageData]);

  // 7. Compute genome position tick marks
  const genomePositions = useGenomePositions(genomicCoords);

  // 7b. Compute tree-time view height for time positions
  const treeTimeHeight = useMemo(() => {
    if (!decksize?.height) return null;
    const heightStr = viewConfig.treeTime?.height || '97%';
    const percent = parseFloat(heightStr) / 100;
    return decksize.height * percent;
  }, [decksize?.height, viewConfig.treeTime?.height]);

  // 7c. Compute time position tick marks for tree-time view
  const timePositions = useTimePositions({
    minTime: treeData?.global_min_time,
    maxTime: treeData?.global_max_time,
    viewState: viewState?.['tree-time'],
    viewHeight: treeTimeHeight
  });

  // 8. Layers for enabled views
  const { layers, layerFilter, clearHover: clearPickingHover } = useDeckLayers({
    enabledViews,
    globalBpPerUnit,
    visibleIntervals,
    genomePositions,
    timePositions,
    renderData,
    colorEdgesByTree,
    treeEdgeColors,
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

  // 9b. Sync external hoveredTreeIndex prop to polygon hover state
  useEffect(() => {
    if (hoveredTreeIndex != null) {
      setHoveredPolygon(hoveredTreeIndex);
    } else {
      // Clear hover when external control is cleared
      // This allows both external control (from InfoFilter) and direct canvas hover
      setHoveredPolygon(null);
    }
  }, [hoveredTreeIndex, setHoveredPolygon]);

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
  const handleDeckHover = useCallback((info, event) => {
    if (!showPolygons) return;
    // Only do polygon hover when nothing pickable is hovered.
    if (info?.object) return;
    const xy = getOrthoLocalXY(deckRef, info, event);
    const x = xy?.x;
    const y = xy?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const hit = findPolygonAtPoint(polygons, x, y);
    setHoveredPolygon(hit?.key ?? null);
  }, [showPolygons, polygons, setHoveredPolygon]);

  const handleDeckClick = useCallback((info, event) => {
    if (!showPolygons) return;
    // If a deck object was picked, its layer handler should handle it.
    if (info?.object) return;
    const xy = getOrthoLocalXY(deckRef, info, event);
    const x = xy?.x;
    const y = xy?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const hit = findPolygonAtPoint(polygons, x, y);
    if (hit?.treeIndex != null) {
      onPolygonClick?.({ key: hit.key, treeIndex: hit.treeIndex, polygon: hit });
    }
  }, [showPolygons, polygons, onPolygonClick]);

  // Ensure hover-driven UI (tooltips, edge highlights) clears when pointer leaves the canvas.
  // DeckGL's onHover won't fire once the pointer is outside the canvas, so we proactively clear.
  const handlePointerLeave = useCallback(() => {
    clearPickingHover?.();
    setHoveredPolygon(null);
  }, [clearPickingHover, setHoveredPolygon]);

  const getSVGString = useCallback((polygonColor = [145, 194, 244, 46]) => {
    const deck = deckRef.current?.deck;
    if (!deck) {
      console.warn('[getSVGString] No deck instance available');
      return null;
    }
    const polygonVertices = polygons?.map(p => p.vertices) || [];
    return getSVG(deck, polygonVertices, polygonColor);
  }, [polygons]);

  const getSVGSize = useCallback((svgString, fallbackWidth, fallbackHeight) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      const widthAttr = svg?.getAttribute('width');
      const heightAttr = svg?.getAttribute('height');
      const viewBox = svg?.getAttribute('viewBox');
      let width = widthAttr ? parseFloat(widthAttr) : Number.NaN;
      let height = heightAttr ? parseFloat(heightAttr) : Number.NaN;
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        if (viewBox) {
          const parts = viewBox.split(/\s+/).map(Number);
          if (parts.length === 4) {
            width = parts[2];
            height = parts[3];
          }
        }
      }
      if (!Number.isFinite(width)) width = fallbackWidth;
      if (!Number.isFinite(height)) height = fallbackHeight;
      return { width, height };
    } catch (err) {
      return { width: fallbackWidth, height: fallbackHeight };
    }
  }, []);

  const getPNGBlob = useCallback(async (polygonColor = [145, 194, 244, 46]) => {
    const svgString = getSVGString(polygonColor);
    if (!svgString) return null;
    const deck = deckRef.current?.deck;
    const canvasEl = deck?.canvas;
    const fallbackWidth = canvasEl?.width || canvasEl?.clientWidth || 0;
    const fallbackHeight = canvasEl?.height || canvasEl?.clientHeight || 0;
    const { width, height } = getSVGSize(svgString, fallbackWidth, fallbackHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve();
        };
        img.onerror = (event) => reject(event);
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }

    return await new Promise((resolve) => {
      canvas.toBlob((pngBlob) => resolve(pngBlob), 'image/png');
    });
  }, [getSVGSize, getSVGString]);

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
    polygonsReady,
    // SVG capture for screenshot functionality
    captureSVG: (polygonColor = [145, 194, 244, 46]) => {
      const svg = getSVGString(polygonColor);
      if (svg) {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'lorax-capture.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    },
    getSVGString,
    getPNGBlob
  }), [viewState, views, viewReset, xzoom, yzoom, genomicCoords, setGenomicCoords, coordsReady, localBins, displayArray, showingAllTrees, treeData, treeDataLoading, treeDataError, polygons, hoveredPolygon, setHoveredPolygon, polygonsReady, getSVGString, getPNGBlob]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onMouseLeave={handlePointerLeave}
      onPointerLeave={handlePointerLeave}
    >
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
                treeColors={polygonOptions?.treeColors}
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
