import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { View } from '@deck.gl/core';
import { useLorax } from '../context/LoraxProvider.jsx';
import { useDeckViews } from '../hooks/useDeckViews.jsx';
import { useDeckLayers } from '../hooks/useDeckLayers.jsx';
import { useDeckController } from '../hooks/useDeckController.jsx';
import { useTreeViewportPipeline } from '../hooks/useTreeViewportPipeline.jsx';
import {
  useLockViewSnapshot,
  LOCK_SNAPSHOT_DEBUG_LABEL_BY_CORNER,
  formatLockSnapshotDebugCoordinate
} from '../hooks/useLockViewSnapshot.jsx';
import {
  computeLocalBBoxCoverageFromViewState,
  LOCK_ZOOM_MIN_COVERAGE
} from '../utils/lockViewSnapshot.js';
import { useGenomePositions } from '../hooks/useGenomePositions.jsx';
import { useTimePositions } from '../hooks/useTimePositions.jsx';
import { useTreePolygons } from '../hooks/useTreePolygons.jsx';
import TreePolygonOverlay from './TreePolygonOverlay.jsx';
import { mergeWithDefaults, validateViewConfig, getEnabledViews } from '../utils/deckViewConfig.js';
import { getSVG } from '../utils/deckglToSvg.js';
import { yToTime } from '../utils/timeScale.js';

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

function parsePercent(spec) {
  if (typeof spec !== 'string') return null;
  const match = spec.match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  const ratio = Number.parseFloat(match[1]) / 100;
  return Number.isFinite(ratio) ? ratio : null;
}

function getViewRectPx(view, width, height) {
  if (!view || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  const xRatio = parsePercent(view.x);
  const yRatio = parsePercent(view.y);
  const widthRatio = parsePercent(view.width);
  const heightRatio = parsePercent(view.height);
  if (
    xRatio == null
    || yRatio == null
    || widthRatio == null
    || heightRatio == null
  ) {
    return null;
  }

  return {
    x: width * xRatio,
    y: height * yRatio,
    width: width * widthRatio,
    height: height * heightRatio
  };
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

/** Debounce delay (ms) before capturing lock view snapshot after view state settles. */
const LOCK_VIEW_SNAPSHOT_DEBOUNCE_MS = 150;
/** Keep interaction mode active briefly after deck reports interaction end. */
const INTERACTION_SETTLE_MS = 120;
const DESCENDANT_HIGHLIGHT_COLOR = [94, 177, 155, 255];
const DESCENDANT_EDGE_ALPHA = 220;
const DESCENDANT_HIGHLIGHT_RADIUS = 4;
const ANCESTRAL_NODE_HIGHLIGHT_RADIUS = 3;
const SELECTED_ANCESTRAL_NODE_HIGHLIGHT_RADIUS = 4;
const DEFAULT_LINEAGE_COLOR = [255, 200, 0, 255];

function normalizeRgbaColor(color, fallback = DEFAULT_LINEAGE_COLOR) {
  const source = Array.isArray(color) ? color : fallback;
  return [
    Number.isFinite(source[0]) ? source[0] : fallback[0],
    Number.isFinite(source[1]) ? source[1] : fallback[1],
    Number.isFinite(source[2]) ? source[2] : fallback[2],
    Number.isFinite(source[3]) ? source[3] : fallback[3]
  ];
}

function mergeLineageColors(colorsByValue) {
  const colors = Array.from(colorsByValue.values()).map((color) => normalizeRgbaColor(color));
  if (colors.length === 0) return DEFAULT_LINEAGE_COLOR;
  if (colors.length === 1) return colors[0];

  const totals = colors.reduce((acc, color) => {
    acc[0] += color[0];
    acc[1] += color[1];
    acc[2] += color[2];
    acc[3] = Math.max(acc[3], color[3]);
    return acc;
  }, [0, 0, 0, 0]);

  return [
    Math.round(totals[0] / colors.length),
    Math.round(totals[1] / colors.length),
    Math.round(totals[2] / colors.length),
    totals[3]
  ];
}

function getEdgeParentPosition(renderData, edgeIndex) {
  if (!renderData || !Number.isInteger(edgeIndex) || edgeIndex < 0) return null;
  const pathStartIndices = renderData.pathStartIndices;
  const pathPositions = renderData.pathPositions;
  if (!pathStartIndices || !pathPositions || edgeIndex >= pathStartIndices.length - 1) return null;

  const coordIndex = pathStartIndices[edgeIndex] * 2;
  const x = pathPositions[coordIndex];
  const y = pathPositions[coordIndex + 1];
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function buildDescendantOverlay({ rootNodeId, descendantLookup, tipData, color }) {
  const descendantNodesByTree = new Map();
  const descendantEdgeIndices = new Set();

  for (const [treeIdx, childrenForTree] of descendantLookup.childrenByTree.entries()) {
    const visited = new Set([rootNodeId]);
    const stack = [rootNodeId];

    while (stack.length > 0) {
      const parentId = stack.pop();
      const childIds = childrenForTree.get(parentId);
      if (!Array.isArray(childIds) || childIds.length === 0) continue;

      for (const childId of childIds) {
        const edgeIndex = descendantLookup.edgeIndexByTreeAndPair
          .get(treeIdx)
          ?.get(`${parentId}|${childId}`);
        if (Number.isInteger(edgeIndex)) {
          descendantEdgeIndices.add(edgeIndex);
        }
        if (!visited.has(childId)) {
          visited.add(childId);
          stack.push(childId);
        }
      }
    }

    descendantNodesByTree.set(treeIdx, visited);
  }

  const tipHighlights = [];
  if (Array.isArray(tipData)) {
    for (const tip of tipData) {
      const treeIdx = Number(tip?.tree_idx);
      const nodeId = Number(tip?.node_id);
      const position = tip?.position;
      if (!Number.isFinite(treeIdx) || !Number.isFinite(nodeId) || !Array.isArray(position)) continue;
      if (!descendantNodesByTree.get(treeIdx)?.has(nodeId)) continue;
      tipHighlights.push({
        kind: 'descendant-tip',
        position,
        color,
        radius: DESCENDANT_HIGHLIGHT_RADIUS,
        tree_idx: treeIdx,
        node_id: nodeId
      });
    }
  }

  return {
    tipHighlights,
    edgeIndices: Array.from(descendantEdgeIndices).sort((a, b) => a - b)
  };
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
 * @param {string} props.timeScale - Time coordinate scale: "linear" or "log"
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
  treeLayersEnabled = true,
  intervalsOnly = false,
  polygonOptions = {},
  onPolygonHover,
  onPolygonClick,
  // Tree interaction callbacks (UI lives in packages/website)
  onTipHover,
  onTipClick,
  onEdgeHover,
  onEdgeClick,
  onMutationHover,
  onMutationClick,
  // Tree loading state callback
  onTreeLoadingChange,
  // Visible trees change callback
  onVisibleTreesChange,
  // Whether current viewport includes all trees
  onShowingAllTreesChange,
  // Number of trees in current genomic window (interval count - 1)
  onTreesInWindowCountChange,
  // External control of polygon hover (for list-to-polygon sync)
  hoveredTreeIndex,
  // Optional: per-tree edge coloring (CSV "color by tree")
  colorEdgesByTree = false,
  treeEdgeColors = null,
  // Optional: node id to highlight (e.g. mutation click)
  highlightedMutationNode = null,
  // Optional: tree index to restrict mutation highlight to (e.g. Info→Mutations click)
  highlightedMutationTreeIndex = null,
  // Compare topology edge colors [r, g, b, a]
  compareInsertionColor = null,
  compareDeletionColor = null,
  showCompareInsertion = true,
  showCompareDeletion = true,
  highlightDescendantsOnHover = false,
  descendantsHighlightColor = null,
  // Tree edge color [r, g, b, a] (used when colorEdgesByTree is false)
  edgeColor = null,

  // Optional: override genomic coords for interval/local data
  externalGenomicCoords = null,
  // Optional: require external coords before querying intervals
  externalGenomicCoordsRequired = false,
  // Optional: sync viewState to external coords
  externalGenomicCoordsSync = false,
  // Default tip color [r, g, b, a] when metadata coloring is unavailable
  defaultTipColor = null,
  timeScale = 'linear',
  // Disable modelMatrix recomputation on zoom; allow pan-driven recomputation
  lockModelMatrix = false,
  // Optional lock-view debug overlay (off by default)
  lockSnapshotDebug = false,
  // Temporary feature flag: keep max-zoom guard disabled by default.
  enableLockMaxZoomGuard = false,
  // Called when zoom-in is blocked due to lock-mode max zoom limit
  onMaxZoomReached,
  // Website-only opt-in: vertical wheel over the time axis pans the shared Y view.
  enableTimeAxisWheelPan = false,
  ...otherProps
}, ref) => {
  const rootRef = useRef(null);
  const deckRef = useRef(null);

  const treeEnabled = !intervalsOnly;
  const renderTrees = treeEnabled && treeLayersEnabled; // todo: remove these two variable to simplify code

  const [lockViewPayload, setLockViewPayload] = useState(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [hoveredAncestralEdge, setHoveredAncestralEdge] = useState(null);
  const [hoveredEdgeForDescendants, setHoveredEdgeForDescendants] = useState(null);
  const [hoveredMatchingEdge, setHoveredMatchingEdge] = useState(null);
  const [selectedAncestralEdge, setSelectedAncestralEdge] = useState(null);
  const interactionSettleTimerRef = useRef(null);
  const suppressNextPolygonClickRef = useRef(false);

  // 1. Merge and validate config
  const viewConfig = mergeWithDefaults(userViewConfig);
  validateViewConfig(viewConfig);
  const enabledViews = getEnabledViews(viewConfig);

  // 2. Controller setup (zoom axis and pan direction state)
  const { zoomAxis, panDirection, wheelPanDeltaX } = useDeckController();

  // 3. Get config + filter values from context
  const {
    globalBpPerUnit,
    genomeLength,
    tsconfig,
    intervalWorker,
    localDataWorker,
    worker,
    workerConfigReady,
    queryTreeLayout,
    queryHighlightPositions,
    queryMultiValueSearch,
    emitCompareTrees,
    compareTreesResult,
    isConnected,
    // Metadata + filter (when enableMetadataFilter=true)
    metadataArrays,
    metadataColors,
    selectedColorBy,
    enabledValues,
    highlightedMetadataValue,
    searchTags,  // Multi-value search tags
    displayLineagePaths,  // Lineage display toggle
    compareMode,
    urlSyncEnabled,
    rpcWorker,
  } = useLorax();

  // Stabilize population filter to avoid rerunning downstream effects every render
  const populationFilter = useMemo(() => {
    if (!selectedColorBy) return null;
    return {
      colorBy: selectedColorBy,
      enabledValues: Array.from(enabledValues || [])
    };
  }, [selectedColorBy, enabledValues]);

  const includeTipData = Boolean(onTipHover || onTipClick);
  const includeEdgeData = Boolean(colorEdgesByTree || onEdgeHover || onEdgeClick || highlightDescendantsOnHover);
  const resolvedDescendantHighlightColor = useMemo(() => {
    if (
      Array.isArray(descendantsHighlightColor)
      && descendantsHighlightColor.length >= 3
      && Number.isFinite(descendantsHighlightColor[0])
      && Number.isFinite(descendantsHighlightColor[1])
      && Number.isFinite(descendantsHighlightColor[2])
    ) {
      return [
        descendantsHighlightColor[0],
        descendantsHighlightColor[1],
        descendantsHighlightColor[2],
        Number.isFinite(descendantsHighlightColor[3]) ? descendantsHighlightColor[3] : 255
      ];
    }
    return DESCENDANT_HIGHLIGHT_COLOR;
  }, [descendantsHighlightColor]);

  const updateInteractionState = useCallback((interactionState) => {
    const active = Boolean(
      interactionState?.isDragging
      || interactionState?.isPanning
      || interactionState?.isZooming
      || interactionState?.inTransition
      || interactionState?.isRotating
    );

    if (active) {
      if (interactionSettleTimerRef.current != null) {
        clearTimeout(interactionSettleTimerRef.current);
        interactionSettleTimerRef.current = null;
      }
      setIsInteracting(true);
      return;
    }

    if (interactionSettleTimerRef.current != null) {
      clearTimeout(interactionSettleTimerRef.current);
    }
    interactionSettleTimerRef.current = setTimeout(() => {
      interactionSettleTimerRef.current = null;
      setIsInteracting(false);
    }, INTERACTION_SETTLE_MS);
  }, []);

  useEffect(() => {
    if (!highlightDescendantsOnHover) {
      setHoveredEdgeForDescendants(null);
      setHoveredAncestralEdge(null);
      setSelectedAncestralEdge(null);
    }
  }, [highlightDescendantsOnHover]);

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
    fitYToBounds,
    panYByWheelDelta,
    // Genomic coordinates
    genomicCoords,
    setGenomicCoords,
    coordsReady
  } = useDeckViews({
    viewConfig,
    enabledViews,
    zoomAxis,
    panDirection,
    wheelPanDeltaX,
    globalBpPerUnit,
    genomeLength,
    tsconfigValue: tsconfig?.value,
    isInteracting,
    urlSyncEnabled
  });

  const activeGenomicCoords = externalGenomicCoordsRequired
    ? externalGenomicCoords
    : (externalGenomicCoords || genomicCoords);

  const externalSyncKeyRef = useRef(null);

  useEffect(() => {
    if (!externalGenomicCoordsSync || !externalGenomicCoords) return;
    if (!coordsReady) return;
    const [start, end] = externalGenomicCoords;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return;
    const deckWidth = decksize?.width ?? 0;
    const key = `${start}:${end}:${globalBpPerUnit}:${deckWidth}`;
    if (externalSyncKeyRef.current === key) return;
    // Keep Lorax viewState aligned to external coords and pixel-width changes.
    setGenomicCoords(externalGenomicCoords);
    externalSyncKeyRef.current = key;
  }, [externalGenomicCoordsSync, externalGenomicCoords, globalBpPerUnit, decksize?.width, coordsReady, setGenomicCoords]);

  // 5. Notify parent when genomicCoords changes
  useEffect(() => {
    // if (genomicCoords && externalOnGenomicCoordsChange) {
      if (activeGenomicCoords && externalOnGenomicCoordsChange) {
      externalOnGenomicCoordsChange(activeGenomicCoords);
    }
  }, [activeGenomicCoords, externalOnGenomicCoordsChange]);

  // 6. Worker-based viewport -> local bins -> tree fetch -> render pipeline
  const {
    interval: { visibleIntervals },
    local: { localBins, displayArray, showingAllTrees },
    tree: {
      treeData,
      isLoading: treeDataLoading,
      isBackgroundRefresh: treeDataBackgroundRefresh,
      fetchReason: treeDataFetchReason,
      error: treeDataError
    },
    render: { renderData: baseRenderData, isLoading: renderDataLoading },
    visibleTreeIndices,
    treesInWindowCount
  } = useTreeViewportPipeline({
    intervalWorker,
    localDataWorker,
    worker,
    workerConfigReady,
    genomicCoords: activeGenomicCoords,
    viewState,
    tsconfig,
    queryTreeLayout,
    isConnected,
    lockModelMatrix,
    lockViewPayload,
    timeScale,
    metadataArrays,
    metadataColors,
    populationFilter,
    defaultTipColor,
    isInteracting,
    includeTipData,
    includeEdgeData,
    treeEnabled,
    renderTrees,
    renderWorkerOverride: rpcWorker || null,
  });

  const nodePositionsLookup = useMemo(() => {
    if (!treeData?.node_id) return new Map();

    const minTime = Number(treeData.global_min_time);
    const maxTime = Number(treeData.global_max_time);
    const canDeriveTime = Number.isFinite(minTime) && Number.isFinite(maxTime);

    // Map<tree_idx, Map<node_id, {x, y, time}>>
    const lookup = new Map();
    for (let i = 0; i < treeData.node_id.length; i++) {
      const treeIdx = treeData.tree_idx[i];
      const nodeId = treeData.node_id[i];
      const y = Number(treeData.y?.[i]);
      const rawTimeValue = treeData.time?.[i];
      const rawTime = rawTimeValue == null ? NaN : Number(rawTimeValue);
      const time = Number.isFinite(rawTime)
        ? rawTime
        : (canDeriveTime && Number.isFinite(y) ? yToTime(y, minTime, maxTime, timeScale) : null);

      if (!lookup.has(treeIdx)) {
        lookup.set(treeIdx, new Map());
      }
      lookup.get(treeIdx).set(nodeId, {
        x: treeData.x[i],
        y,
        time
      });
    }
    return lookup;
  }, [treeData, timeScale]);

  const getNodePosition = useCallback((treeIdx, nodeId) => (
    nodePositionsLookup.get(Number(treeIdx))?.get(Number(nodeId)) || null
  ), [nodePositionsLookup]);

  const enrichTipHoverPayload = useCallback((tip) => {
    if (!tip) return null;
    const node = getNodePosition(tip.tree_idx, tip.node_id);
    return {
      ...tip,
      node_time: Number.isFinite(node?.time) ? node.time : null
    };
  }, [getNodePosition]);

  const enrichEdgeHoverPayload = useCallback((edge) => {
    if (!edge) return null;
    const parentNode = getNodePosition(edge.tree_idx, edge.parent_id);
    const childNode = getNodePosition(edge.tree_idx, edge.child_id);
    return {
      ...edge,
      parent_time: Number.isFinite(parentNode?.time) ? parentNode.time : null,
      child_time: Number.isFinite(childNode?.time) ? childNode.time : null
    };
  }, [getNodePosition]);

  const enrichMutationHoverPayload = useCallback((mutation) => {
    if (!mutation) return null;
    const node = getNodePosition(mutation.tree_idx, mutation.node_id);
    const mutationTime = Number(mutation.mutation_time);
    return {
      ...mutation,
      mutation_time: Number.isFinite(mutationTime) ? mutationTime : null,
      node_time: Number.isFinite(node?.time) ? node.time : null
    };
  }, [getNodePosition]);

  const handleTipHover = useCallback((tip, info, event) => {
    onTipHover?.(enrichTipHoverPayload(tip), info, event);
  }, [enrichTipHoverPayload, onTipHover]);

  const suppressNextPolygonClick = useCallback(() => {
    suppressNextPolygonClickRef.current = true;
    setTimeout(() => {
      suppressNextPolygonClickRef.current = false;
    }, 0);
  }, []);

  const handleTipClick = useCallback((tip, info, event) => {
    const enrichedTip = enrichTipHoverPayload(tip);
    if (enrichedTip) {
      suppressNextPolygonClick();
    }
    onTipClick?.(enrichedTip, info, event);
  }, [enrichTipHoverPayload, onTipClick, suppressNextPolygonClick]);

  const handleEdgeHover = useCallback((edge, info, event) => {
    const enrichedEdge = enrichEdgeHoverPayload(edge);
    const edgeIndex = Number(info?.index);
    if (
      enrichedEdge
      && Number.isFinite(enrichedEdge.tree_idx)
      && Number.isFinite(enrichedEdge.parent_id)
      && Number.isFinite(enrichedEdge.child_id)
    ) {
      const hoverEdge = {
        tree_idx: enrichedEdge.tree_idx,
        parent_id: enrichedEdge.parent_id,
        child_id: enrichedEdge.child_id,
        edge_index: Number.isInteger(edgeIndex) ? edgeIndex : null
      };
      setHoveredAncestralEdge(highlightDescendantsOnHover ? hoverEdge : null);
      setHoveredMatchingEdge({
        tree_idx: enrichedEdge.tree_idx,
        parent_id: enrichedEdge.parent_id,
        child_id: enrichedEdge.child_id
      });
    } else {
      setHoveredAncestralEdge(null);
      setHoveredMatchingEdge(null);
    }

    if (
      highlightDescendantsOnHover
      && enrichedEdge
      && Number.isFinite(enrichedEdge.tree_idx)
      && Number.isFinite(enrichedEdge.child_id)
    ) {
      setHoveredEdgeForDescendants({
        tree_idx: enrichedEdge.tree_idx,
        parent_id: enrichedEdge.parent_id,
        child_id: enrichedEdge.child_id,
        edge_index: Number.isInteger(edgeIndex) ? edgeIndex : null
      });
    } else {
      setHoveredEdgeForDescendants(null);
    }
    onEdgeHover?.(enrichedEdge, info, event);
  }, [enrichEdgeHoverPayload, highlightDescendantsOnHover, onEdgeHover]);

  const handleEdgeClick = useCallback((edge, info, event) => {
    const enrichedEdge = enrichEdgeHoverPayload(edge);
    if (enrichedEdge) {
      suppressNextPolygonClick();
    }
    if (
      highlightDescendantsOnHover
      && enrichedEdge
      && Number.isFinite(enrichedEdge.tree_idx)
      && Number.isFinite(enrichedEdge.parent_id)
      && Number.isFinite(enrichedEdge.child_id)
    ) {
      setSelectedAncestralEdge({
        tree_idx: Number(enrichedEdge.tree_idx),
        parent_id: Number(enrichedEdge.parent_id),
        child_id: Number(enrichedEdge.child_id)
      });
    } else if (!highlightDescendantsOnHover) {
      setSelectedAncestralEdge(null);
    }

    onEdgeClick?.(enrichedEdge, info, event);
  }, [enrichEdgeHoverPayload, highlightDescendantsOnHover, onEdgeClick, suppressNextPolygonClick]);

  const handleMutationHover = useCallback((mutation, info, event) => {
    onMutationHover?.(enrichMutationHoverPayload(mutation), info, event);
  }, [enrichMutationHoverPayload, onMutationHover]);

  const handleMutationClick = useCallback((mutation, info, event) => {
    const enrichedMutation = enrichMutationHoverPayload(mutation);
    if (enrichedMutation) {
      suppressNextPolygonClick();
    }
    onMutationClick?.(enrichedMutation, info, event);
  }, [enrichMutationHoverPayload, onMutationClick, suppressNextPolygonClick]);

  const {
    lockViewPayload: latestLockViewPayload,
    lockSnapshotDebugOverlay,
    scheduleCapture: scheduleLockSnapshotCapture,
    flushPendingCapture: flushPendingLockSnapshotCapture
  } = useLockViewSnapshot({
    deckRef,
    localBins,
    lockModelMatrix,
    debug: lockSnapshotDebug
  });

  const lockSnapshotDebounceRef = useRef(null);

  const debouncedScheduleLockSnapshotCapture = useCallback(() => {
    if (lockSnapshotDebounceRef.current != null) {
      clearTimeout(lockSnapshotDebounceRef.current);
    }
    lockSnapshotDebounceRef.current = setTimeout(() => {
      lockSnapshotDebounceRef.current = null;
      scheduleLockSnapshotCapture();
    }, LOCK_VIEW_SNAPSHOT_DEBOUNCE_MS);
  }, [scheduleLockSnapshotCapture]);

  useEffect(() => () => {
    if (lockSnapshotDebounceRef.current != null) {
      clearTimeout(lockSnapshotDebounceRef.current);
      lockSnapshotDebounceRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (interactionSettleTimerRef.current != null) {
      clearTimeout(interactionSettleTimerRef.current);
      interactionSettleTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setLockViewPayload(latestLockViewPayload);
  }, [latestLockViewPayload]);

  useEffect(() => {
    if (!lockModelMatrix) return;
    scheduleLockSnapshotCapture();
  }, [lockModelMatrix, displayArray, scheduleLockSnapshotCapture]);

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

  // 6c.3. Notify parent when viewport reaches "showing all trees" state
  useEffect(() => {
    onShowingAllTreesChange?.(showingAllTrees);
  }, [showingAllTrees, onShowingAllTreesChange]);

  // 6c.4. Notify parent when trees-in-window count changes
  useEffect(() => {
    onTreesInWindowCountChange?.(treesInWindowCount);
  }, [treesInWindowCount, onTreesInWindowCountChange]);

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

      queryHighlightPositions(selectedColorBy, highlightedMetadataValue, visibleTreeIndices, { timeScale })
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
  }, [highlightedMetadataValue, selectedColorBy, visibleTreeIndices, queryHighlightPositions, isConnected, timeScale]);

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
  const compareDebounceRef = useRef(null);

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

      queryMultiValueSearch(selectedColorBy, searchTags, displayArray, displayLineagePaths, { timeScale })
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
  }, [searchTags, selectedColorBy, visibleTreeIndices, queryMultiValueSearch, isConnected, displayLineagePaths, timeScale]);

  // Emit visible tree indices when compare mode is enabled (debounced)
  useEffect(() => {
    if (compareDebounceRef.current) {
      clearTimeout(compareDebounceRef.current);
      compareDebounceRef.current = null;
    }
    if (!compareMode || !isConnected || !emitCompareTrees) {
      return;
    }
    if (visibleTreeIndices.length === 0) {
      return;
    }
    compareDebounceRef.current = setTimeout(() => {
      emitCompareTrees(displayArray, { timeScale });
    }, 150);
    return () => {
      if (compareDebounceRef.current) {
        clearTimeout(compareDebounceRef.current);
      }
    };
  }, [compareMode, visibleTreeIndices, displayArray, emitCompareTrees, isConnected, timeScale]);

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
    const defaultColor = [0, 0, 0, 255];
    const defaultRadius = 7;

    // Canonical axis contract: mut_x is horizontal layout, mut_y is vertical time.
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

      const layout = treeData.mut_x[i];
      const time = treeData.mut_y[i];
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

  // Compute lineage path data when displayLineagePaths is enabled
  const computedLineageData = useMemo(() => {
    if (!displayLineagePaths || !multiHighlightData?.lineages || !localBins || nodePositionsLookup.size === 0) {
      return [];
    }

    const lineageSegments = new Map();
    const valueToColor = metadataColors?.[selectedColorBy] || {};

    for (const [value, treeLineages] of Object.entries(multiHighlightData.lineages)) {
      const defaultColor = valueToColor[value] || DEFAULT_LINEAGE_COLOR;

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

          const lineageColor = normalizeRgbaColor(lineage.color || defaultColor, defaultColor);

          for (let i = 0; i < pathNodeIds.length - 1; i++) {
            const parentId = pathNodeIds[i];
            const childId = pathNodeIds[i + 1];
            const parentPos = nodePositions.get(parentId);
            const childPos = nodePositions.get(childId);
            if (!parentPos || !childPos) continue;

            const parentWorldX = parentPos.x * scaleX + translateX;
            const parentWorldY = parentPos.y * scaleY + translateY;
            const childWorldX = childPos.x * scaleX + translateX;
            const childWorldY = childPos.y * scaleY + translateY;

            const segmentKey = `${treeIdx}:${parentId}:${childId}`;
            let segment = lineageSegments.get(segmentKey);
            if (!segment) {
              segment = {
                path: [
                  [parentWorldX, parentWorldY],
                  [childWorldX, parentWorldY],
                  [childWorldX, childWorldY]
                ],
                treeIdx,
                parentNodeId: parentId,
                childNodeId: childId,
                colorsByValue: new Map()
              };
              lineageSegments.set(segmentKey, segment);
            }

            if (!segment.colorsByValue.has(value)) {
              segment.colorsByValue.set(value, lineageColor);
            }
          }
        }
      }
    }

    return Array.from(lineageSegments.values()).map((segment) => {
      const values = Array.from(segment.colorsByValue.keys());
      return {
        path: segment.path,
        color: mergeLineageColors(segment.colorsByValue),
        treeIdx: segment.treeIdx,
        value: values.length === 1 ? values[0] : values.join(', '),
        values,
        parentNodeId: segment.parentNodeId,
        childNodeId: segment.childNodeId
      };
    });
  }, [displayLineagePaths, multiHighlightData, localBins, nodePositionsLookup, metadataColors, selectedColorBy]);

  // Compute compare edges (inserted/removed) from compare_trees result
  const computedCompareEdgesData = useMemo(() => {
    if (!compareMode || !compareTreesResult?.comparisons?.length || !localBins) {
      return [];
    }

    const edges = [];
    const insertedColor = compareInsertionColor ?? [0, 255, 0, 200];
    const removedColor = compareDeletionColor ?? [255, 0, 0, 200];

    for (const comp of compareTreesResult.comparisons) {
      const { prev_idx: prevIdx, next_idx: nextIdx, inserted = [], removed = [] } = comp;

      // Inserted edges: use next_idx modelMatrix
      const nextBin = localBins.get(nextIdx);
      if (showCompareInsertion && nextBin?.modelMatrix) {
        const m = nextBin.modelMatrix;
        const scaleX = m[0];
        const scaleY = m[5];
        const translateX = m[12];
        const translateY = m[13];

        for (const e of inserted) {
          const parentWorldX = e.parent_x * scaleX + translateX;
          const parentWorldY = e.parent_y * scaleY + translateY;
          const childWorldX = e.child_x * scaleX + translateX;
          const childWorldY = e.child_y * scaleY + translateY;
          edges.push({
            path: [[parentWorldX, parentWorldY], [childWorldX, parentWorldY], [childWorldX, childWorldY]],
            color: insertedColor
          });
        }
      }

      // Removed edges: use prev_idx modelMatrix
      const prevBin = localBins.get(prevIdx);
      if (showCompareDeletion && prevBin?.modelMatrix) {
        const m = prevBin.modelMatrix;
        const scaleX = m[0];
        const scaleY = m[5];
        const translateX = m[12];
        const translateY = m[13];

        for (const e of removed) {
          const parentWorldX = e.parent_x * scaleX + translateX;
          const parentWorldY = e.parent_y * scaleY + translateY;
          const childWorldX = e.child_x * scaleX + translateX;
          const childWorldY = e.child_y * scaleY + translateY;
          edges.push({
            path: [[parentWorldX, parentWorldY], [childWorldX, parentWorldY], [childWorldX, childWorldY]],
            color: removedColor
          });
        }
      }
    }

    return edges;
  }, [compareMode, compareTreesResult, localBins, compareInsertionColor, compareDeletionColor, showCompareInsertion, showCompareDeletion]);

  const descendantLookup = useMemo(() => {
    const childrenByTree = new Map();
    const edgeIndexByTreeAndPair = new Map();
    const edgeIndicesByPair = new Map();
    const edges = baseRenderData?.edgeData;
    if (!Array.isArray(edges) || edges.length === 0) {
      return { childrenByTree, edgeIndexByTreeAndPair, edgeIndicesByPair };
    }

    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
      const edge = edges[edgeIndex];
      const treeIdx = Number(edge?.tree_idx);
      const parentId = Number(edge?.parent_id);
      const childId = Number(edge?.child_id);
      if (!Number.isFinite(treeIdx) || !Number.isFinite(parentId) || !Number.isFinite(childId)) {
        continue;
      }

      if (!childrenByTree.has(treeIdx)) {
        childrenByTree.set(treeIdx, new Map());
      }
      const childrenForTree = childrenByTree.get(treeIdx);
      if (!childrenForTree.has(parentId)) {
        childrenForTree.set(parentId, []);
      }
      childrenForTree.get(parentId).push(childId);

      if (!edgeIndexByTreeAndPair.has(treeIdx)) {
        edgeIndexByTreeAndPair.set(treeIdx, new Map());
      }
      const pairKey = `${parentId}|${childId}`;
      edgeIndexByTreeAndPair.get(treeIdx).set(pairKey, edgeIndex);

      if (!edgeIndicesByPair.has(pairKey)) {
        edgeIndicesByPair.set(pairKey, []);
      }
      edgeIndicesByPair.get(pairKey).push({ treeIdx, edgeIndex });
    }

    return { childrenByTree, edgeIndexByTreeAndPair, edgeIndicesByPair };
  }, [baseRenderData?.edgeData]);

  const matchingEdgeIndices = useMemo(() => {
    if (
      !hoveredMatchingEdge
      || !Number.isFinite(hoveredMatchingEdge.tree_idx)
      || !Number.isFinite(hoveredMatchingEdge.parent_id)
      || !Number.isFinite(hoveredMatchingEdge.child_id)
    ) {
      return [];
    }

    const pairKey = `${Number(hoveredMatchingEdge.parent_id)}|${Number(hoveredMatchingEdge.child_id)}`;
    const matches = descendantLookup.edgeIndicesByPair.get(pairKey);
    if (!Array.isArray(matches) || matches.length === 0) return [];

    const hoveredTreeIdx = Number(hoveredMatchingEdge.tree_idx);
    return matches
      .filter(({ treeIdx }) => treeIdx !== hoveredTreeIdx)
      .map(({ edgeIndex }) => edgeIndex)
      .sort((a, b) => a - b);
  }, [hoveredMatchingEdge, descendantLookup]);

  const computedDescendantHoverOverlay = useMemo(() => {
    const emptyResult = { tipHighlights: [], edgeIndices: [] };
    if (!highlightDescendantsOnHover) return emptyResult;
    if (selectedAncestralEdge) return emptyResult;
    if (!hoveredEdgeForDescendants || !Number.isFinite(hoveredEdgeForDescendants.parent_id)) return emptyResult;
    const rootNodeId = Number(hoveredEdgeForDescendants.parent_id);
    return buildDescendantOverlay({
      rootNodeId,
      descendantLookup,
      tipData: baseRenderData?.tipData,
      color: resolvedDescendantHighlightColor
    });
  }, [highlightDescendantsOnHover, selectedAncestralEdge, hoveredEdgeForDescendants, baseRenderData?.tipData, descendantLookup, resolvedDescendantHighlightColor]);

  const computedAncestralSelectionOverlay = useMemo(() => {
    const emptyResult = { nodeHighlights: [], tipHighlights: [], edgeIndices: [] };
    if (!highlightDescendantsOnHover) return emptyResult;
    const edges = baseRenderData?.edgeData;
    if (!Array.isArray(edges) || edges.length === 0) return emptyResult;

    const markerByKey = new Map();
    const selectedEdgeIndices = new Set();
    const selectedTipHighlights = [];

    const addParentMarker = (edgeIndex, edge, selected = false) => {
      const parentId = Number(edge?.parent_id);
      const treeIdx = Number(edge?.tree_idx);
      if (!Number.isFinite(parentId) || !Number.isFinite(treeIdx)) return;

      const position = getEdgeParentPosition(baseRenderData, edgeIndex);
      if (!position) return;

      const markerKey = `${treeIdx}|${parentId}|${position[0]}|${position[1]}`;
      markerByKey.set(markerKey, {
        kind: 'ancestral-parent-node',
        position,
        color: resolvedDescendantHighlightColor,
        fillColor: resolvedDescendantHighlightColor,
        radius: selected ? SELECTED_ANCESTRAL_NODE_HIGHLIGHT_RADIUS : ANCESTRAL_NODE_HIGHLIGHT_RADIUS,
        tree_idx: treeIdx,
        node_id: parentId,
        selected
      });
    };

    if (!selectedAncestralEdge && hoveredAncestralEdge && Number.isInteger(hoveredAncestralEdge.edge_index)) {
      addParentMarker(hoveredAncestralEdge.edge_index, hoveredAncestralEdge, false);
    }

    if (
      selectedAncestralEdge
      && Number.isFinite(selectedAncestralEdge.parent_id)
      && Number.isFinite(selectedAncestralEdge.child_id)
    ) {
      const selectedParentId = Number(selectedAncestralEdge.parent_id);
      const selectedDescendants = buildDescendantOverlay({
        rootNodeId: selectedParentId,
        descendantLookup,
        tipData: baseRenderData?.tipData,
        color: resolvedDescendantHighlightColor
      });
      selectedTipHighlights.push(...selectedDescendants.tipHighlights);
      for (const edgeIndex of selectedDescendants.edgeIndices) {
        selectedEdgeIndices.add(edgeIndex);
      }

      for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
        const edge = edges[edgeIndex];
        const parentId = Number(edge?.parent_id);
        if (!Number.isFinite(parentId) || parentId !== selectedParentId) continue;

        addParentMarker(edgeIndex, edge, true);
      }
    }

    return {
      nodeHighlights: Array.from(markerByKey.values()),
      tipHighlights: selectedTipHighlights,
      edgeIndices: Array.from(selectedEdgeIndices).sort((a, b) => a - b)
    };
  }, [highlightDescendantsOnHover, baseRenderData, hoveredAncestralEdge, selectedAncestralEdge, descendantLookup, resolvedDescendantHighlightColor]);

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

    if (computedDescendantHoverOverlay.tipHighlights.length > 0) {
      mergedHighlights.push(...computedDescendantHoverOverlay.tipHighlights);
    }

    if (computedAncestralSelectionOverlay.nodeHighlights.length > 0) {
      mergedHighlights.push(...computedAncestralSelectionOverlay.nodeHighlights);
    }

    if (computedAncestralSelectionOverlay.tipHighlights.length > 0) {
      mergedHighlights.push(...computedAncestralSelectionOverlay.tipHighlights);
    }

    if (mergedHighlights.length > 0) {
      result.highlightData = mergedHighlights;
    }

    const descendantEdgeIndices = new Set([
      ...computedDescendantHoverOverlay.edgeIndices,
      ...computedAncestralSelectionOverlay.edgeIndices
    ]);
    if (descendantEdgeIndices.size > 0) {
      result.descendantEdgeIndices = Array.from(descendantEdgeIndices).sort((a, b) => a - b);
    }

    if (matchingEdgeIndices.length > 0) {
      result.matchingEdgeIndices = matchingEdgeIndices;
    }

    // Add lineage data when enabled
    if (computedLineageData && computedLineageData.length > 0) {
      result.lineageData = computedLineageData;
    }

    // Add compare edges when compare mode is on
    if (computedCompareEdgesData && computedCompareEdgesData.length > 0) {
      result.compareEdgesData = computedCompareEdgesData;
    }

    return result;
  }, [baseRenderData, computedHighlightData, computedMultiHighlightData, computedMutationHighlightData, computedDescendantHoverOverlay, computedAncestralSelectionOverlay, matchingEdgeIndices, computedLineageData, computedCompareEdgesData]);

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
    viewHeight: treeTimeHeight,
    timeScale
  });

  const getOrthoViewHeightPx = useCallback(() => {
    if (!decksize?.height) return null;
    const heightStr = viewConfig?.ortho?.height;
    if (!heightStr) return null;
    const percent = parseFloat(heightStr) / 100;
    if (!Number.isFinite(percent)) return null;
    return decksize.height * percent;
  }, [decksize?.height, viewConfig?.ortho?.height]);

  const orthoViewportPx = useMemo(() => {
    if (!decksize?.width || !decksize?.height) return null;
    const widthRatio = parsePercent(viewConfig?.ortho?.width) ?? 1;
    const heightRatio = parsePercent(viewConfig?.ortho?.height) ?? 1;
    const width = decksize.width * widthRatio;
    const height = decksize.height * heightRatio;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { width, height };
  }, [decksize?.width, decksize?.height, viewConfig?.ortho?.width, viewConfig?.ortho?.height]);

  const getVisibleYBounds = useCallback(() => {
    let minY = Infinity;
    let maxY = -Infinity;

    const updateFromArray = (arr) => {
      if (!arr || arr.length < 2) return;
      for (let i = 1; i < arr.length; i += 2) {
        const y = arr[i];
        if (!Number.isFinite(y)) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    };

    updateFromArray(renderData?.pathPositions);
    updateFromArray(renderData?.tipPositions);

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      const ys = treeData?.y;
      if (Array.isArray(ys) && ys.length > 0) {
        for (const v of ys) {
          if (!Number.isFinite(v)) continue;
          if (v < minY) minY = v;
          if (v > maxY) maxY = v;
        }
      }
    }

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null;
    return { minY, maxY };
  }, [renderData, treeData]);

  const viewAdjustY = useCallback(() => {
    const bounds = getVisibleYBounds();
    const viewHeightPx = getOrthoViewHeightPx();
    if (bounds && Number.isFinite(viewHeightPx)) {
      const applied = fitYToBounds({
        minY: bounds.minY,
        maxY: bounds.maxY,
        viewHeightPx
      });
      if (applied) return true;
    }
    viewReset();
    return false;
  }, [getVisibleYBounds, getOrthoViewHeightPx, fitYToBounds, viewReset]);

  // 8. Layers for enabled views
  const { layers, layerFilter, clearHover: clearPickingHover } = useDeckLayers({
    enabledViews,
    globalBpPerUnit,
    visibleIntervals,
    genomePositions,
    timePositions,
    renderData,
    xzoom,
    colorEdgesByTree,
    treeEdgeColors,
    edgeColor,
    descendantEdgeColor: [
      resolvedDescendantHighlightColor[0],
      resolvedDescendantHighlightColor[1],
      resolvedDescendantHighlightColor[2],
      Number.isFinite(resolvedDescendantHighlightColor[3]) ? resolvedDescendantHighlightColor[3] : DESCENDANT_EDGE_ALPHA
    ],
    // Tree interactions
    onTipHover: handleTipHover,
    onTipClick: handleTipClick,
    onEdgeHover: handleEdgeHover,
    onEdgeClick: handleEdgeClick,
    onMutationHover: handleMutationHover,
    onMutationClick: handleMutationClick,
    enableTreeLayers: treeEnabled && treeLayersEnabled
  });

  // 9. Tree polygon overlay computation and animation
  const {
    polygons,
    hoveredPolygon,
    setHoveredPolygon,
    isReady: polygonsReady,
    onAfterRender: onPolygonsAfterRender
  } = useTreePolygons({
    localBins,
    globalBpPerUnit,
    viewState,
    enabled: showPolygons && treeEnabled,
    animate: polygonOptions?.animate ?? true,
    animationDuration: polygonOptions?.animationDuration ?? 300,
    easing: polygonOptions?.easing ?? 'easeOut',
    viewStateUpdateThrottleMs: polygonOptions?.viewStateUpdateThrottleMs ?? 0,
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
    updateInteractionState(params?.interactionState);

    if (
      enableLockMaxZoomGuard
      && lockModelMatrix
      && params?.viewId === 'ortho'
      && orthoViewportPx
      && localBins?.size > 0
    ) {
      const newZoom = params.viewState?.zoom;
      const oldZoom = params.oldViewState?.zoom;
      const newZ0 = Array.isArray(newZoom) ? newZoom[0] : newZoom;
      const newZ1 = Array.isArray(newZoom) ? newZoom[1] : newZoom;
      const oldZ0 = Array.isArray(oldZoom) ? oldZoom[0] : oldZoom;
      const oldZ1 = Array.isArray(oldZoom) ? oldZoom[1] : oldZoom;
      const isZoomingIn = (Number.isFinite(newZ0) && Number.isFinite(oldZ0) && newZ0 > oldZ0)
        || (Number.isFinite(newZ1) && Number.isFinite(oldZ1) && newZ1 > oldZ1);

      if (isZoomingIn) {
        const coverage = computeLocalBBoxCoverageFromViewState({
          viewState: params.viewState,
          viewportWidth: orthoViewportPx.width,
          viewportHeight: orthoViewportPx.height,
          localBins
        });
        if (coverage != null && coverage <= LOCK_ZOOM_MIN_COVERAGE) {
          internalHandleViewStateChange({ ...params, viewState: params.oldViewState });
          debouncedScheduleLockSnapshotCapture();
          externalOnViewStateChange?.({ ...params, viewState: params.oldViewState });
          onMaxZoomReached?.();
          return;
        }
      }
    }

    internalHandleViewStateChange(params);
    debouncedScheduleLockSnapshotCapture();
    externalOnViewStateChange?.(params);
  }, [enableLockMaxZoomGuard, lockModelMatrix, orthoViewportPx, localBins, internalHandleViewStateChange, externalOnViewStateChange, debouncedScheduleLockSnapshotCapture, updateInteractionState, onMaxZoomReached]);

  const handleTimeAxisWheelCapture = useCallback((event) => {
    if (!enableTimeAxisWheelPan) return;
    if (!viewConfig?.treeTime?.enabled) return;
    if (!decksize?.width || !decksize?.height) return;

    const deltaX = event.deltaX || 0;
    const deltaY = event.deltaY || 0;
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    if (Math.abs(deltaY) < Math.abs(deltaX)) return;

    const bounds = event.currentTarget?.getBoundingClientRect?.();
    if (!bounds) return;

    const treeTimeRect = getViewRectPx(
      viewConfig.treeTime,
      decksize.width,
      decksize.height
    );
    if (!treeTimeRect) return;

    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const insideTreeTime =
      x >= treeTimeRect.x
      && x <= treeTimeRect.x + treeTimeRect.width
      && y >= treeTimeRect.y
      && y <= treeTimeRect.y + treeTimeRect.height;

    if (!insideTreeTime) return;

    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation();
    const applied = panYByWheelDelta?.(deltaY);
    if (applied !== false) {
      debouncedScheduleLockSnapshotCapture();
    }
  }, [
    decksize?.height,
    decksize?.width,
    debouncedScheduleLockSnapshotCapture,
    enableTimeAxisWheelPan,
    panYByWheelDelta,
    viewConfig?.treeTime
  ]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enableTimeAxisWheelPan) return undefined;
    root.addEventListener('wheel', handleTimeAxisWheelCapture, {
      capture: true,
      passive: false
    });
    return () => {
      root.removeEventListener('wheel', handleTimeAxisWheelCapture, {
        capture: true
      });
    };
  }, [enableTimeAxisWheelPan, handleTimeAxisWheelCapture]);

  const handleAfterRender = useCallback(() => {
    if (showPolygons && treeEnabled && onPolygonsAfterRender && deckRef.current?.deck) {
      onPolygonsAfterRender(deckRef.current.deck);
    }
    flushPendingLockSnapshotCapture();
  }, [showPolygons, treeEnabled, onPolygonsAfterRender, flushPendingLockSnapshotCapture]);

  // Enable deck.gl picking loop for layer-level onHover/onClick and
  // implement polygon hover/click without letting the SVG overlay intercept pointer events.
  const handleDeckHover = useCallback((info, event) => {
    if (!showPolygons || !treeEnabled) return;
    // Only do polygon hover when nothing pickable is hovered.
    if (info?.object) return;
    const xy = getOrthoLocalXY(deckRef, info, event);
    const x = xy?.x;
    const y = xy?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const hit = findPolygonAtPoint(polygons, x, y);
    setHoveredPolygon(hit?.key ?? null);
  }, [showPolygons, polygons,treeEnabled, setHoveredPolygon]);

  const handleDeckClick = useCallback((info, event) => {
    if (!showPolygons || !treeEnabled) return;
    if (lockModelMatrix) return; // no polygon click when locked-in
    if (suppressNextPolygonClickRef.current) {
      suppressNextPolygonClickRef.current = false;
      return;
    }
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
  }, [showPolygons, treeEnabled, polygons, onPolygonClick, lockModelMatrix]);

  // Ensure hover-driven UI (tooltips, edge highlights) clears when pointer leaves the canvas.
  // DeckGL's onHover won't fire once the pointer is outside the canvas, so we proactively clear.
  const handlePointerLeave = useCallback(() => {
    clearPickingHover?.();
    setHoveredEdgeForDescendants(null);
    setHoveredMatchingEdge(null);
    setHoveredPolygon(null);
  }, [clearPickingHover, setHoveredPolygon]);

  const getSVGString = useCallback((polygonColor = [145, 194, 244, 46]) => {
    const deck = deckRef.current?.deck;
    if (!deck) {
      console.warn('[getSVGString] No deck instance available');
      return null;
    }
    return getSVG(deck, polygons || [], {
      fillColor: polygonColor,
      hoverFillColor: polygonOptions?.hoverFillColor,
      treeColors: polygonOptions?.treeColors || {}
    });
  }, [polygons, polygonOptions?.hoverFillColor, polygonOptions?.treeColors]);

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
    viewAdjustY,
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
    treesInWindowCount,
    // Tree data from backend
    treeData,
    treeDataLoading,
    treeDataBackgroundRefresh,
    treeDataFetchReason,
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
  }), [viewState, views, viewReset, xzoom, yzoom, genomicCoords, setGenomicCoords, coordsReady, localBins, displayArray, showingAllTrees, treesInWindowCount, treeData, treeDataLoading, treeDataBackgroundRefresh, treeDataFetchReason, treeDataError, polygons, hoveredPolygon, setHoveredPolygon, polygonsReady, getSVGString, getPNGBlob]);

  return (
    <div
      ref={rootRef}
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
      {lockSnapshotDebug && lockSnapshotDebugOverlay && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${decksize?.width || 1} ${decksize?.height || 1}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 20
          }}
        >
          <rect
            x={lockSnapshotDebugOverlay.x}
            y={lockSnapshotDebugOverlay.y}
            width={lockSnapshotDebugOverlay.width}
            height={lockSnapshotDebugOverlay.height}
            fill="none"
            stroke="rgba(255, 0, 64, 0.95)"
            strokeWidth={2}
            strokeDasharray="8 5"
          />
          {lockSnapshotDebugOverlay.corners.map((corner) => {
            const labelCfg = LOCK_SNAPSHOT_DEBUG_LABEL_BY_CORNER[corner.corner] || LOCK_SNAPSHOT_DEBUG_LABEL_BY_CORNER.topLeft;
            const labelText = `${corner.corner} x:${formatLockSnapshotDebugCoordinate(corner.x)} y:${formatLockSnapshotDebugCoordinate(corner.y)}`;
            const treeText = `tree:${corner.treeIndex ?? 'null'}`;
            return (
              <g key={corner.corner}>
                <circle
                  cx={corner.px}
                  cy={corner.py}
                  r={4}
                  fill="rgba(255, 0, 64, 0.95)"
                  stroke="white"
                  strokeWidth={1}
                />
                <text
                  x={corner.px + labelCfg.dx}
                  y={corner.py + labelCfg.dy}
                  textAnchor={labelCfg.textAnchor}
                  fill="rgba(255, 0, 64, 0.98)"
                  fontSize={12}
                  fontWeight={700}
                  stroke="rgba(255, 255, 255, 0.85)"
                  strokeWidth={2}
                  paintOrder="stroke"
                >
                  {labelText}
                </text>
                <text
                  x={corner.px + labelCfg.dx}
                  y={corner.py + labelCfg.dy + 14}
                  textAnchor={labelCfg.textAnchor}
                  fill="rgba(255, 0, 64, 0.98)"
                  fontSize={11}
                  fontWeight={700}
                  stroke="rgba(255, 255, 255, 0.85)"
                  strokeWidth={2}
                  paintOrder="stroke"
                >
                  {treeText}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
});

LoraxDeckGL.displayName = 'LoraxDeckGL';

export default LoraxDeckGL;
