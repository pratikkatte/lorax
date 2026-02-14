import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLorax, LoraxDeckGL } from '@lorax/core';
import PositionSlider from './PositionSlider';
import ViewportOverlay from './ViewportOverlay';
import Info from './Info';
import Settings from './Settings';
import ScreenshotModal from './ScreenshotModal';
import { useViewportDimensions } from '../hooks/useViewportDimensions';
import TourOverlay from './TourOverlay';
import useTourState from '../hooks/useTourState';
import { metadataFeatureActions } from '../config/metadataFeatureActions';
// TODO: Re-enable when the tutorial is complete.
const TOUR_ENABLED = false;

/**
 * FileView component - displays loaded file with viewport and position controls.
 * Handles both navigation from LandingPage and direct URL access.
 */
function FileView() {
  const { file } = useParams();
  const [searchParams] = useSearchParams();
  const deckRef = useRef(null);
  const appliedInitialTreeEdgeColorsRef = useRef(false);

  const {
    queryFile,
    handleConfigUpdate,
    tsconfig,
    filename,
    genomeLength,
    isConnected,
    queryDetails,
    // For tip hover tooltip value computation
    selectedColorBy,
    metadataArrays
  } = useLorax();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [genomicPosition, setGenomicPosition] = useState(null); // [start, end] - synced with deck
  const [statusMessage, setStatusMessage] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [infoActiveTab, setInfoActiveTab] = useState('details');
  const [treeIsLoading, setTreeIsLoading] = useState(false);
  const treeIsLoadingRef = useRef(false);
  const presetLoadResolversRef = useRef([]);
  const pendingPresetLoadRef = useRef(false);
  const presetLoadTimeoutRef = useRef(null);
  const pendingPresetActionsRef = useRef([]);
  const tourState = useTourState('viewer');
  const [tourOpen, setTourOpen] = useState(false);
  const [tourActiveStepId, setTourActiveStepId] = useState(null);
  const [tourPolygonClicked, setTourPolygonClicked] = useState(false);
  const [tourEdgeClicked, setTourEdgeClicked] = useState(false);
  const [tourSelectedTreeIndex, setTourSelectedTreeIndex] = useState(null);
  const [tourCenterTreeIndex, setTourCenterTreeIndex] = useState(null);
  const [tourTargetTick, setTourTargetTick] = useState(0);
  const lastTourTargetUpdateRef = useRef(0);

  // Navigation state for mutation tab
  const [clickedGenomeInfo, setClickedGenomeInfo] = useState(null);
  const [highlightedMutationNode, setHighlightedMutationNode] = useState(null);
  const [highlightedMutationTreeIndex, setHighlightedMutationTreeIndex] = useState(null);

  // Right-panel details (populated by queryDetails)
  const [treeDetails, setTreeDetails] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [individualDetails, setIndividualDetails] = useState(null);
  const [populationDetails, setPopulationDetails] = useState(null);
  const [nodeMutations, setNodeMutations] = useState(null);
  const [nodeEdges, setNodeEdges] = useState(null);

  // Extra: selected metadata key/value for a clicked tip
  const [selectedTipMetadata, setSelectedTipMetadata] = useState(null); // { key, value } | null

  // Visible trees state (array of tree indices visible in viewport)
  const [visibleTrees, setVisibleTrees] = useState([]);
  const [showingAllTrees, setShowingAllTrees] = useState(false);
  const [treesInWindowCount, setTreesInWindowCount] = useState(0);
  // Per-tree color customization { [treeIndex]: '#hexcolor' }
  const [treeColors, setTreeColors] = useState({});
  // Per-tree edge/path colors { [treeIndex]: '#hexcolor' } (CSV tree_info defaults)
  const [treeEdgeColors, setTreeEdgeColors] = useState({});
  // CSV-only: color edges by tree index (tree_idx)
  const [colorByTree, setColorByTree] = useState(false);
  // Hovered tree index (for list-to-polygon hover sync)
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState(null);
  // Polygon fill color [r, g, b, a]
  const [polygonFillColor, setPolygonFillColor] = useState([145, 194, 244, 46]);
  // Compare topology edge colors [r, g, b, a]
  const [compareInsertionColor, setCompareInsertionColor] = useState([0, 255, 0, 200]);
  const [compareDeletionColor, setCompareDeletionColor] = useState([255, 0, 0, 200]);
  const [showCompareInsertion, setShowCompareInsertion] = useState(true);
  const [showCompareDeletion, setShowCompareDeletion] = useState(true);
  // Tree edge color [r, g, b, a] (used when colorEdgesByTree is false)
  const [edgeColor, setEdgeColor] = useState([100, 100, 100, 255]);
  // Controls whether model matrix recomputes on zoom interactions.
  const [lockModelMatrix, setLockModelMatrix] = useState(false);
  // Tracks whether lock view was auto-enabled from showingAllTrees behavior.
  const autoLockModelMatrixRef = useRef(false);
  // User manual OFF should temporarily block auto re-enable until context reset.
  const manualLockOffOverrideRef = useRef(false);

  // Hover tooltip state (rendered in website, not in core)
  const [hoverTooltip, setHoverTooltip] = useState(null); // { kind, x, y, title, rows[] }

  const clearHoverTooltip = useCallback(() => setHoverTooltip(null), []);

  const getOrthoViewport = useCallback(() => {
    const deck = deckRef.current?.getDeck?.();
    const viewports = deck?.getViewports?.();
    if (!Array.isArray(viewports)) return null;
    return viewports.find((vp) => vp?.id === 'ortho') || null;
  }, []);

  const getPolygonBounds = useCallback((polygon) => {
    const vertices = polygon?.vertices;
    if (!Array.isArray(vertices) || vertices.length < 3) return null;

    const deck = deckRef.current?.getDeck?.();
    const canvas = deck?.canvas;
    const canvasRect = canvas?.getBoundingClientRect?.();
    const ortho = getOrthoViewport();
    if (!canvasRect || !ortho) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const vertex of vertices) {
      const x = vertex?.[0];
      const y = vertex?.[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;

    const left = canvasRect.left + (ortho.x ?? 0) + minX;
    const top = canvasRect.top + (ortho.y ?? 0) + minY;
    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) {
      return null;
    }

    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    };
  }, [getOrthoViewport]);

  const getCenterPolygon = useCallback(() => {
    const polygons = deckRef.current?.polygons;
    if (!Array.isArray(polygons) || polygons.length === 0) return null;
    const ortho = getOrthoViewport();
    if (!ortho) return null;

    const centerX = (ortho.width ?? 0) / 2;
    const centerY = (ortho.height ?? 0) / 2;
    let best = null;
    let bestDist = Infinity;

    for (const polygon of polygons) {
      const vertices = polygon?.vertices;
      if (!Array.isArray(vertices) || vertices.length < 3) continue;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const vertex of vertices) {
        const x = vertex?.[0];
        const y = vertex?.[1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (!Number.isFinite(minX) || !Number.isFinite(maxX)) continue;

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const dx = cx - centerX;
      const dy = cy - centerY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = polygon;
      }
    }

    return best;
  }, [getOrthoViewport]);

  const getTourPolygonRect = useCallback((preferredTreeIndex) => {
    const polygons = deckRef.current?.polygons;
    if (!Array.isArray(polygons) || polygons.length === 0) return null;

    let polygon = null;
    if (preferredTreeIndex != null) {
      polygon = polygons.find((p) => p?.treeIndex === preferredTreeIndex) || null;
    }
    if (!polygon) {
      polygon = getCenterPolygon();
    }
    if (!polygon) return null;

    return getPolygonBounds(polygon);
  }, [getCenterPolygon, getPolygonBounds]);

  const tourSteps = useMemo(() => {
    const panGestureMedia = '/gestures/gesture-flick.ogv';
    const twoFingerScrollMedia = '/gestures/gesture-two-finger-scroll.ogv';

    return ([
      {
        id: 'viewer-position',
        target: '[data-tour="viewer-position"]',
        title: 'Genome window',
        content: 'Pan and set the genomic range you want to explore. Click Go to apply edits.'
      },
      {
        id: 'viewer-viewport',
        target: '[data-tour="viewer-viewport"]',
        title: 'Main viewport',
        content: 'Interact with trees in the viewport. Hover for details and click nodes or edges.'
      },
      {
        id: 'viewer-pan',
        target: '[data-tour="viewer-viewport"]',
        title: 'Pan left and right',
        content: 'Drag horizontally on the viewport to pan across the genome.',
        animation: {
          label: 'Pan gesture',
          mediaType: 'video',
          mediaUrl: panGestureMedia,
          mediaAlt: 'One finger swipe left and right',
          attribution: 'Wikimedia Commons (CC BY-SA 3.0)'
        }
      },
      {
        id: 'viewer-zoom-y',
        target: '[data-tour="viewer-viewport"]',
        title: 'Vertical zoom',
        content: 'Use two fingers up or down to zoom vertically.',
        animation: {
          label: 'Two-finger vertical zoom',
          mediaType: 'video',
          mediaUrl: twoFingerScrollMedia,
          mediaAlt: 'Two finger swipe up and down',
          attribution: 'Wikimedia Commons (CC BY-SA 3.0)'
        }
      },
      {
        id: 'viewer-zoom-x',
        target: '[data-tour="viewer-viewport"]',
        title: 'Horizontal zoom',
        content: 'Hold Ctrl and use two fingers left or right to zoom horizontally.',
        animation: {
          label: 'Ctrl + two-finger zoom',
          mediaType: 'video',
          mediaUrl: twoFingerScrollMedia,
          mediaAlt: 'Two finger swipe left and right',
          rotate: 90,
          showCtrl: true,
          attribution: 'Wikimedia Commons (CC BY-SA 3.0)'
        }
      },
      {
        id: 'viewer-tree-polygon',
        title: 'Pick a tree',
        content: 'The center tree is highlighted. Hover it to see details, then click any tree to zoom in.',
        getTargetRect: () => getTourPolygonRect(tourCenterTreeIndex),
        targetKey: tourTargetTick,
        disableNext: !tourPolygonClicked
      },
      {
        id: 'viewer-tree-edge',
        title: 'Open tree details',
        content: 'Click any edge on the highlighted tree to open the Info panel.',
        getTargetRect: () => getTourPolygonRect(tourSelectedTreeIndex ?? tourCenterTreeIndex),
        targetKey: tourTargetTick,
        disableNext: !tourEdgeClicked
      },
      {
        id: 'viewer-info-button',
        target: '[data-tour="viewer-info-button"]',
        title: 'Info & Filters',
        content: 'Open metadata, mutations, and filtering controls for deeper inspection.',
        offset: { x: -60, y: -60 },
        arrowDir: 'right'
      },
      {
        id: 'viewer-info-details',
        target: '[data-tour="viewer-info-details-tab"]',
        title: 'Details',
        content: 'Explore tree, node, and sample details for the selected tree.',
        offset: { x: 10, y: 20 },
        arrowDir: 'up'
      },
      {
        id: 'viewer-info-mutations',
        target: '[data-tour="viewer-info-mutations-tab"]',
        title: 'Mutations',
        content: 'Browse mutations for the current window or search by position.',
        offset: { x: 0, y: 20 },
        arrowDir: 'up'
      },
      {
        id: 'viewer-info-filter',
        target: '[data-tour="viewer-info-filter-tab"]',
        title: 'Filters',
        content: 'Color and filter trees to focus on specific structures.',
        offset: { x: 0, y: 20 },
        arrowDir: 'up'
      },
      {
        id: 'viewer-settings-button',
        target: '[data-tour="viewer-settings-button"]',
        title: 'Settings',
        content: 'Customize display options like colors and view settings.',
        offset: { x: -60, y: -60 },
        arrowDir: 'right'
      }
    ]);
  }, [getTourPolygonRect, tourCenterTreeIndex, tourSelectedTreeIndex, tourTargetTick, tourPolygonClicked, tourEdgeClicked]);

  const getSelectedMetadataValueForNode = useCallback((nodeId) => {
    const key = selectedColorBy;
    if (!key) return null;
    const arr = metadataArrays?.[key];
    if (!arr) return null;
    const idx = arr.nodeIdToIdx?.get?.(nodeId);
    if (idx === undefined) return null;
    const valueIdx = arr.indices?.[idx];
    return arr.uniqueValues?.[valueIdx] ?? null;
  }, [selectedColorBy, metadataArrays]);

  const setTooltipFromEvent = useCallback((base, info, event) => {
    // Prefer DOM coordinates when available, fall back to deck.gl's canvas-relative coords.
    const src = event?.srcEvent;
    const clientX = src?.clientX;
    const clientY = src?.clientY;
    const x = Number.isFinite(clientX) ? clientX : info?.x;
    const y = Number.isFinite(clientY) ? clientY : info?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setHoverTooltip({ ...base, x, y });
  }, []);

  const resetDetails = useCallback(() => {
    setTreeDetails(null);
    setNodeDetails(null);
    setIndividualDetails(null);
    setPopulationDetails(null);
    setNodeMutations(null);
    setNodeEdges(null);
    setSelectedTipMetadata(null);
  }, []);

  // Convenience: populate right-panel from queryDetails response
  // Keep the originating tree index around for downstream UI actions (e.g. highlight mutations).
  const applyDetailsResponse = useCallback((data, treeIndex = null) => {
    const tree = data?.tree ?? null;
    setTreeDetails(tree ? { ...tree, tree_idx: treeIndex } : null);
    setNodeDetails(data?.node ?? null);
    setIndividualDetails(data?.individual ?? null);
    setPopulationDetails(data?.population ?? null);
    setNodeMutations(data?.mutations ?? null);
    setNodeEdges(data?.edges ?? null);
  }, []);

  // Viewport and view dimensions with localStorage persistence
  const {
    viewport,
    views,
    updateViewport,
    updateView
  } = useViewportDimensions();

  // Get project and genomic coordinates from URL params
  const project = searchParams.get('project');
  const sid = searchParams.get('sid');
  const genomiccoordstart = searchParams.get('genomiccoordstart');
  const genomiccoordend = searchParams.get('genomiccoordend');

  // Load file config from URL params if not already loaded
  useEffect(() => {
    // Only load if we have required params and config isn't loaded for this file
    if (file && project && isConnected && !tsconfig?.filename) {
      setLoading(true);
      setError(null);
      setStatusMessage({ status: 'loading', message: 'Loading file...' });

      // Build payload with genomic coords if present
      const payload = {
        file,
        project,
        share_sid: sid
      };

      if (genomiccoordstart && genomiccoordend) {
        payload.genomiccoordstart = parseInt(genomiccoordstart, 10);
        payload.genomiccoordend = parseInt(genomiccoordend, 10);
      }

      queryFile(payload)
        .then(result => {
          if (result && result.config) {
            // Pass null for value - backend initial_position takes precedence
            handleConfigUpdate(result.config, null, project, sid);
          }
        })
        .catch(err => {
          console.error('FileView: Error loading file:', err);
          setError(err.message || 'Failed to load file');
        })
        .finally(() => {
          setLoading(false);
          setStatusMessage(null);
        });
    }
  }, [file, project, sid, genomiccoordstart, genomiccoordend, isConnected, tsconfig?.filename, queryFile, handleConfigUpdate]);

  useEffect(() => {
    if (!TOUR_ENABLED) return;
    if (!tourState.hasSeen && tsconfig && !loading && !error) {
      setTourOpen(true);
    }
  }, [tourState.hasSeen, tsconfig, loading, error]);

  useEffect(() => {
    if (!tourOpen) return;
    setTourActiveStepId(null);
    setTourPolygonClicked(false);
    setTourEdgeClicked(false);
    setTourSelectedTreeIndex(null);
    setTourCenterTreeIndex(null);
    setTourTargetTick(0);
    lastTourTargetUpdateRef.current = 0;
  }, [tourOpen]);

  const requestTourTargetUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastTourTargetUpdateRef.current < 50) return;
    lastTourTargetUpdateRef.current = now;
    setTourTargetTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!tourOpen) return;
    if (tourActiveStepId === 'viewer-tree-polygon' || tourActiveStepId === 'viewer-tree-edge') {
      requestTourTargetUpdate();
    }
  }, [tourOpen, tourActiveStepId, requestTourTargetUpdate]);

  useEffect(() => {
    if (!tourOpen) return;
    if (tourActiveStepId !== 'viewer-tree-polygon' && tourActiveStepId !== 'viewer-tree-edge') return;

    const polygons = deckRef.current?.polygons;
    if (tourCenterTreeIndex != null) {
      const stillVisible = Array.isArray(polygons) && polygons.some((p) => p?.treeIndex === tourCenterTreeIndex);
      if (stillVisible) return;
    }
    const center = getCenterPolygon();
    if (center?.treeIndex != null) {
      setTourCenterTreeIndex(center.treeIndex);
    }
  }, [tourOpen, tourActiveStepId, tourCenterTreeIndex, getCenterPolygon, tourTargetTick]);

  // Apply backend-provided per-tree defaults for edge/path colors (CSV only, optional).
  // Backend provides: tsconfig.tree_info = { [treeIndex]: "#RRGGBB" }
  // Do not override if user already customized edge colors.
  useEffect(() => {
    if (appliedInitialTreeEdgeColorsRef.current) return;
    const initial = tsconfig?.tree_info;
    if (!initial || typeof initial !== 'object') return;
    if (Object.keys(initial).length === 0) return;
    setTreeEdgeColors(initial);
    appliedInitialTreeEdgeColorsRef.current = true;
  }, [tsconfig?.tree_info]);

  // Initialize position when config loads (only if deck hasn't set it yet)
  useEffect(() => {
    if (tsconfig && genomeLength && !genomicPosition) {
      // Use value from config if available, otherwise full genome range
      const initialValue = tsconfig.value || [0, genomeLength];
      setGenomicPosition(initialValue);
    }
  }, [tsconfig, genomeLength, genomicPosition]);

  // Handle navigation from mutation click - zoom to tree
  useEffect(() => {
    if (clickedGenomeInfo && deckRef.current?.setGenomicCoords) {
      const newPosition = [clickedGenomeInfo.s, clickedGenomeInfo.e];
      deckRef.current.setGenomicCoords(newPosition);
      // Clear after navigation to allow clicking same mutation again
      setClickedGenomeInfo(null);
    }
  }, [clickedGenomeInfo]);

  // Callback when deck.gl view changes (pan/zoom) - syncs deck → slider
  const handleGenomicCoordsChange = useCallback((coords) => {
    if (coords) {
      setGenomicPosition(coords);
    }
  }, []);

  const handleDeckViewStateChange = useCallback(() => {
    if (!tourOpen) return;
    if (tourActiveStepId === 'viewer-tree-polygon' || tourActiveStepId === 'viewer-tree-edge') {
      requestTourTargetUpdate();
    }
  }, [tourOpen, tourActiveStepId, requestTourTargetUpdate]);

  // Handle slider position change - syncs slider → deck
  const handlePositionChange = useCallback((newPosition) => {
    setGenomicPosition(newPosition);
    // Update deck view via ref
    if (deckRef.current?.setGenomicCoords) {
      deckRef.current.setGenomicCoords(newPosition);
    }
  }, []);

  const handlePresetNavigate = useCallback((coords) => {
    if (!Array.isArray(coords) || coords.length !== 2) return;
    const start = Number(coords[0]);
    const end = Number(coords[1]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const newPosition = [start, end];
    pendingPresetLoadRef.current = true;
    setGenomicPosition(newPosition);
    if (deckRef.current?.setGenomicCoords) {
      deckRef.current.setGenomicCoords(newPosition);
    }
    return new Promise((resolve) => {
      if (presetLoadTimeoutRef.current) {
        clearTimeout(presetLoadTimeoutRef.current);
      }
      presetLoadTimeoutRef.current = setTimeout(() => {
        if (!pendingPresetLoadRef.current) return;
        pendingPresetLoadRef.current = false;
        presetLoadResolversRef.current.splice(0).forEach((resolver) => resolver());
      }, 1500);
      if (!treeIsLoadingRef.current) {
        setTimeout(() => {
          if (!pendingPresetLoadRef.current) return;
          if (!treeIsLoadingRef.current) {
            pendingPresetLoadRef.current = false;
            presetLoadResolversRef.current.splice(0).forEach((resolver) => resolver());
            resolve();
            return;
          }
          presetLoadResolversRef.current.push(resolve);
        }, 0);
        return;
      }
      presetLoadResolversRef.current.push(resolve);
    });
  }, []);

  // Handle tree loading state changes from LoraxDeckGL
  const handleTreeLoadingChange = useCallback((loading) => {
    setTreeIsLoading(loading);
    treeIsLoadingRef.current = loading;
    if (!loading && tourOpen) {
      if (tourActiveStepId === 'viewer-tree-polygon' || tourActiveStepId === 'viewer-tree-edge') {
        requestTourTargetUpdate();
      }
    }
    if (!loading && pendingPresetLoadRef.current) {
      pendingPresetLoadRef.current = false;
      if (presetLoadTimeoutRef.current) {
        clearTimeout(presetLoadTimeoutRef.current);
        presetLoadTimeoutRef.current = null;
      }
      presetLoadResolversRef.current.splice(0).forEach((resolver) => resolver());
    }
  }, [tourOpen, tourActiveStepId, requestTourTargetUpdate]);

  useEffect(() => {
    treeIsLoadingRef.current = treeIsLoading;
  }, [treeIsLoading]);

  const handlePresetAction = useCallback((actions, feature) => {
    if (!Array.isArray(actions)) return;
    actions.forEach((action) => {
      const handler = metadataFeatureActions?.[action];
      if (typeof handler === 'function') {
        const applied = handler({ deckRef, feature });
        if (applied === false) {
          pendingPresetActionsRef.current.push({ action, feature });
        }
      }
    });
  }, []);

  useEffect(() => {
    if (treeIsLoading) return;
    if (!Array.isArray(visibleTrees) || visibleTrees.length === 0) return;
    if (pendingPresetActionsRef.current.length === 0) return;
    const pending = pendingPresetActionsRef.current.splice(0);
    const retry = [];
    pending.forEach(({ action, feature }) => {
      const handler = metadataFeatureActions?.[action];
      if (typeof handler !== 'function') return;
      const applied = handler({ deckRef, feature });
      if (applied === false) {
        retry.push({ action, feature });
      }
    });
    if (retry.length > 0) {
      pendingPresetActionsRef.current.push(...retry);
    }
  }, [treeIsLoading, visibleTrees]);

  const handlePresetMutationHighlight = useCallback((feature) => {
    const mutationEntry = Array.isArray(feature?.mutation) ? feature.mutation[0] : null;
    if (!mutationEntry) return;
    const nodeId = mutationEntry?.nodeId ?? mutationEntry?.nodeid ?? mutationEntry?.node_id;
    if (nodeId === null || nodeId === undefined || nodeId === '') return;
    const treeIndexRaw = mutationEntry?.treeIndex ?? mutationEntry?.treeindx ?? mutationEntry?.tree_idx;
    const treeIndex = (treeIndexRaw === null || treeIndexRaw === undefined || treeIndexRaw === '')
      ? null
      : treeIndexRaw;
    setHighlightedMutationNode(String(nodeId));
    setHighlightedMutationTreeIndex(treeIndex);
  }, [setHighlightedMutationNode, setHighlightedMutationTreeIndex]);

  // Handle visible trees change from LoraxDeckGL
  const handleVisibleTreesChange = useCallback((trees) => {
    setVisibleTrees(trees || []);
  }, []);

  // Track user-driven lock view toggles separately from auto-lock behavior.
  const handleLockModelMatrixChange = useCallback((locked) => {
    const nextLocked = Boolean(locked);
    autoLockModelMatrixRef.current = false;
    manualLockOffOverrideRef.current = !nextLocked;
    setLockModelMatrix(nextLocked);
  }, []);

  // Track whether all trees are currently shown in the viewport.
  const handleShowingAllTreesChange = useCallback((showing) => {
    const nextShowing = Boolean(showing);
    if (!nextShowing) {
      // Context reset: user manual OFF no longer blocks future auto-enable.
      manualLockOffOverrideRef.current = false;
    }
    setShowingAllTrees(nextShowing);
  }, []);

  const handleTreesInWindowCountChange = useCallback((count) => {
    setTreesInWindowCount(Number.isFinite(count) ? count : 0);
  }, []);

  const AUTO_UNLOCK_MAX_VISIBLE_TREES = 10;

  useEffect(() => {
    autoLockModelMatrixRef.current = false;
    manualLockOffOverrideRef.current = false;
  }, [tsconfig?.file_path, tsconfig?.genome_length]);

  // When all trees are shown, enforce lock view.
  // If lock was auto-enabled, release it only after tree-count threshold is exceeded.
  useEffect(() => {
    if (
      showingAllTrees
      && !lockModelMatrix
      && treesInWindowCount <= AUTO_UNLOCK_MAX_VISIBLE_TREES
      && !manualLockOffOverrideRef.current
    ) {
      autoLockModelMatrixRef.current = true;
      setLockModelMatrix(true);
    }

    if (
      lockModelMatrix
      && autoLockModelMatrixRef.current
      && treesInWindowCount > AUTO_UNLOCK_MAX_VISIBLE_TREES
    ) {
      autoLockModelMatrixRef.current = false;
      setLockModelMatrix(false);
    }
  }, [showingAllTrees, lockModelMatrix, treesInWindowCount]);

  const handlePolygonClick = useCallback(async (payload) => {
    const treeIndex = payload?.treeIndex;
    if (treeIndex == null) return;

    if (tourOpen && tourActiveStepId === 'viewer-tree-polygon') {
      setTourPolygonClicked(true);
      setTourSelectedTreeIndex(treeIndex);
    }

    try {
      const intervals = tsconfig?.intervals;
      if (!Array.isArray(intervals)) return;

      const start = intervals[treeIndex];
      const end = intervals[treeIndex + 1];
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;

      // Zoom to the clicked tree interval
      setGenomicPosition([start, end]);
      deckRef.current?.setGenomicCoords?.([start, end]);
    } catch (err) {
      console.error('[FileView] Failed to zoom to polygon interval:', err);
    }
  }, [tsconfig?.intervals, tourOpen, tourActiveStepId]);

  const handleEdgeClick = useCallback(async (edge) => {
    if (!edge?.tree_idx && edge?.tree_idx !== 0) return;

    if (tourOpen && tourActiveStepId === 'viewer-tree-polygon') {
      await handlePolygonClick({ treeIndex: edge.tree_idx });
    }

    if (tourOpen && tourActiveStepId === 'viewer-tree-edge') {
      if (tourSelectedTreeIndex == null || edge.tree_idx === tourSelectedTreeIndex) {
        setTourEdgeClicked(true);
      }
    }

    try {
      setShowInfo(true);
      resetDetails();
      const details = await queryDetails({ treeIndex: edge.tree_idx });
      applyDetailsResponse(details, edge.tree_idx);
    } catch (e) {
      console.error('[FileView] edge click queryDetails failed:', e);
    }
  }, [tourOpen, tourActiveStepId, tourSelectedTreeIndex, handlePolygonClick, queryDetails, applyDetailsResponse, resetDetails]);

  return (
    <div className="h-screen flex min-h-0 overflow-hidden bg-slate-50 relative">
      {/* Main content column (PositionSlider + viewport) - full width, panels overlay */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Position Slider - Header bar */}
        <PositionSlider
          filename={filename || file}
          genomeLength={genomeLength}
          value={genomicPosition}
          onChange={handlePositionChange}
          onResetY={() => deckRef.current?.viewAdjustY?.()}
          project={project}
          tsconfig={tsconfig}
          lockModelMatrix={lockModelMatrix}
          setLockModelMatrix={handleLockModelMatrixChange}
        />

        {/* Main viewport area */}
        <div className="flex-1 relative bg-white">
        {/* ViewportOverlay - Container box with loading state */}
        <ViewportOverlay
          statusMessage={loading ? { status: 'loading', message: 'Loading file...' } : statusMessage}
          filename={filename || file}
          viewport={viewport}
          onViewportChange={updateViewport}
          views={views}
          onViewChange={updateView}
          resizable={!loading && !error && tsconfig}
          treeIsLoading={treeIsLoading}
          timelineLabel={tsconfig?.times?.type}
          dataTour="viewer-viewport"
        />

        {/* Error display */}
        {error && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-red-800">Error</h3>
              <p className="text-red-600 mt-2">{error}</p>
              <a
                href="/"
                className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Back to Projects
              </a>
            </div>
          </div>
        )}

        {/* LoraxDeckGL canvas - renders when config is loaded */}
        {!loading && !error && tsconfig && (
          <div
            style={{
              position: 'absolute',
              top: viewport.top,
              left: viewport.left,
              width: viewport.width,
              height: viewport.height
            }}
            onMouseLeave={clearHoverTooltip}
          >
            <LoraxDeckGL
              ref={deckRef}
              viewConfig={{
                ortho: { enabled: true, ...views?.ortho },
                genomeInfo: { enabled: true, ...views?.genomeInfo },
                genomePositions: { enabled: true, ...views?.genomePositions },
                treeTime: { enabled: true, ...views?.treeTime }
              }}
              colorEdgesByTree={colorByTree}
              treeEdgeColors={treeEdgeColors}
              highlightedMutationNode={highlightedMutationNode}
              highlightedMutationTreeIndex={highlightedMutationTreeIndex}
              onGenomicCoordsChange={handleGenomicCoordsChange}
              onViewStateChange={handleDeckViewStateChange}
              onTreeLoadingChange={handleTreeLoadingChange}
              onVisibleTreesChange={handleVisibleTreesChange}
              onShowingAllTreesChange={handleShowingAllTreesChange}
              onTreesInWindowCountChange={handleTreesInWindowCountChange}
              hoveredTreeIndex={hoveredTreeIndex}
              polygonOptions={{ treeColors, fillColor: polygonFillColor }}
              compareInsertionColor={compareInsertionColor}
              compareDeletionColor={compareDeletionColor}
              showCompareInsertion={showCompareInsertion}
              showCompareDeletion={showCompareDeletion}
              edgeColor={edgeColor}
              lockModelMatrix={lockModelMatrix}
              onPolygonClick={handlePolygonClick}
              onTipHover={(tip, info, event) => {
                if (!tip) {
                  clearHoverTooltip();
                  return;
                }
                const value = getSelectedMetadataValueForNode(tip.node_id);
                setTooltipFromEvent({
                  kind: 'tip',
                  title: 'Tip',
                  rows: [
                    { k: 'Tree', v: tip.tree_idx },
                    { k: 'Node ID', v: tip.node_id || tip.node_id },
                    ...(selectedColorBy ? [{ k: selectedColorBy, v: value ?? '-' }] : [])
                  ]
                }, info, event);
              }}
              onTipClick={async (tip) => {
                if (tip?.tree_idx == null || tip?.node_id == null) return;
                try {
                  setShowInfo(true);
                  resetDetails();
                  const details = await queryDetails({
                    treeIndex: tip.tree_idx,
                    node: tip.node_id,
                    comprehensive: true
                  });
                  applyDetailsResponse(details, tip.tree_idx);
                  if (selectedColorBy) {
                    const value = getSelectedMetadataValueForNode(tip.node_id);
                    setSelectedTipMetadata({ key: selectedColorBy, value: value ?? '-' });
                  }
                } catch (e) {
                  console.error('[FileView] tip click queryDetails failed:', e);
                }
              }}
              onEdgeHover={(edge, info, event) => {
                if (!edge) {
                  clearHoverTooltip();
                  return;
                }
                setTooltipFromEvent({
                  kind: 'edge',
                  title: 'Edge',
                  rows: [
                    { k: 'Tree', v: edge.tree_idx },
                    { k: 'Parent', v: edge.parent_id },
                    { k: 'Child', v: edge.child_id }
                  ]
                }, info, event);
              }}
              onEdgeClick={handleEdgeClick}
            />

            {/* Hover tooltip (website-owned UI) */}
            {hoverTooltip && Number.isFinite(hoverTooltip.x) && Number.isFinite(hoverTooltip.y) && (
              <div
                style={{
                  position: 'fixed',
                  left: hoverTooltip.x + 16,
                  top: hoverTooltip.y - 8,
                  zIndex: 99999,
                  pointerEvents: 'none',
                  backgroundColor: '#fff',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
                  borderRadius: 10,
                  minWidth: 180,
                  maxWidth: 320,
                  border: '1px solid rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  fontFamily: '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif',
                }}
              >
                <div style={{ padding: '10px 12px', fontSize: '13px', color: '#374151' }}>
                  {hoverTooltip.title && (
                    <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                      {hoverTooltip.title}
                    </div>
                  )}
                  {Array.isArray(hoverTooltip.rows) && hoverTooltip.rows.map((row) => (
                    <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>{row.k}</span>
                      <span style={{ fontWeight: 600, color: '#111827', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(row.v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showScreenshotModal && (
          <ScreenshotModal
            deckRef={deckRef}
            polygonFillColor={polygonFillColor}
            onClose={() => setShowScreenshotModal(false)}
          />
        )}

        <TourOverlay
          open={tourOpen}
          steps={tourSteps}
          onClose={() => setTourOpen(false)}
          onFinish={() => {
            tourState.markSeen();
            setTourOpen(false);
          }}
          onStepChange={(_, step) => {
            const stepId = step?.id ?? null;
            setTourActiveStepId(stepId);

            if (stepId === 'viewer-info-details') {
              setShowInfo(true);
              setShowSettings(false);
              setInfoActiveTab('details');
            } else if (stepId === 'viewer-info-mutations') {
              setShowInfo(true);
              setShowSettings(false);
              setInfoActiveTab('mutations');
            } else if (stepId === 'viewer-info-filter') {
              setShowInfo(true);
              setShowSettings(false);
              setInfoActiveTab('metadata');
            }
          }}
        />
      </div>
      </div>

      {/* Info Panel - overlay when open */}
      {showInfo && (
        <div className="absolute top-0 right-8 bottom-0 w-[25%] min-w-[320px] max-w-[480px] overflow-auto bg-white border-l border-slate-200 shadow-xl z-50">
          <Info
            setShowInfo={setShowInfo}
            activeTab={infoActiveTab}
            onTabChange={setInfoActiveTab}
            genomicCoords={genomicPosition}
            setClickedGenomeInfo={setClickedGenomeInfo}
            setHighlightedMutationNode={setHighlightedMutationNode}
            setHighlightedMutationTreeIndex={setHighlightedMutationTreeIndex}
            treeDetails={treeDetails}
            nodeDetails={nodeDetails}
            individualDetails={individualDetails}
            populationDetails={populationDetails}
            nodeMutations={nodeMutations}
            nodeEdges={nodeEdges}
            selectedTipMetadata={selectedTipMetadata}
            visibleTrees={visibleTrees}
            treeColors={treeColors}
            setTreeColors={setTreeColors}
            treeEdgeColors={treeEdgeColors}
            setTreeEdgeColors={setTreeEdgeColors}
            colorByTree={colorByTree}
            setColorByTree={setColorByTree}
            hoveredTreeIndex={hoveredTreeIndex}
            setHoveredTreeIndex={setHoveredTreeIndex}
            onNavigateToCoords={handlePresetNavigate}
            onPresetAction={handlePresetAction}
            onPresetMutationHighlight={handlePresetMutationHighlight}
          />
        </div>
      )}

      {/* Settings Panel - overlay when open */}
      {showSettings && (
        <div className="absolute top-0 right-8 bottom-0 w-[25%] min-w-[320px] max-w-[480px] overflow-auto bg-white border-l border-slate-200 shadow-xl z-50">
          <Settings
            setShowSettings={setShowSettings}
            polygonFillColor={polygonFillColor}
            setPolygonFillColor={setPolygonFillColor}
            compareInsertionColor={compareInsertionColor}
            setCompareInsertionColor={setCompareInsertionColor}
            compareDeletionColor={compareDeletionColor}
            setCompareDeletionColor={setCompareDeletionColor}
            showCompareInsertion={showCompareInsertion}
            setShowCompareInsertion={setShowCompareInsertion}
            showCompareDeletion={showCompareDeletion}
            setShowCompareDeletion={setShowCompareDeletion}
            edgeColor={edgeColor}
            setEdgeColor={setEdgeColor}
          />
        </div>
      )}

      {/* Right: icon bar - always visible, side-by-side */}
      <div className="flex-shrink-0 w-8 bg-slate-900 border-l border-slate-800 text-slate-400 z-[101] flex flex-col items-center py-4 space-y-4 shadow-2xl">
          {/* Info button */}
          <button
            onClick={() => {
              setShowSettings(false);
              setShowInfo(!showInfo);
            }}
            data-tour="viewer-info-button"
            className={`group relative p-2 rounded-lg transition-colors ${
              showInfo
                ? 'bg-emerald-600 text-white'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
            title="Info & Filters"
          >
            {/* Kanban/list icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Info & Filters
            </span>
          </button>

          {/* Settings button */}
          <button
            onClick={() => {
              setShowInfo(false);
              setShowSettings(!showSettings);
            }}
            data-tour="viewer-settings-button"
            className={`group relative p-2 rounded-lg transition-colors ${
              showSettings
                ? 'bg-emerald-600 text-white'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
            title="Settings"
          >
            {/* Gear icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Settings
            </span>
          </button>

          {/* Screenshot button */}
          <button
            onClick={() => {
              setShowInfo(false);
              setShowSettings(false);
              setShowScreenshotModal(true);
            }}
            className="group relative p-2 rounded-lg transition-colors hover:bg-slate-800 hover:text-white"
            title="Screenshot"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Screenshot
            </span>
          </button>
        </div>
    </div>
  );
}

export default FileView;
