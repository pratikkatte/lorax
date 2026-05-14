import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { LuDna } from 'react-icons/lu';
import {
  HoverTooltip,
  formatTooltipTime,
  formatTooltipValue,
  getTooltipClientCoords,
  useLorax,
  LoraxDeckGL
} from '@lorax/core';
import PositionSlider from './PositionSlider';
import ViewportOverlay from './ViewportOverlay';
import Info from './Info';
import ErrorAlert from './ErrorAlert';
import Settings from './Settings';
import ScreenshotModal from './ScreenshotModal';
import { useViewportDimensions } from '../hooks/useViewportDimensions';
import TourOverlay from './TourOverlay';
import useTourState from '../hooks/useTourState';
import { metadataFeatureActions } from '../config/metadataFeatureActions';
import { viewerTourNarrationById } from '../data/viewerTourNarration';
import { buildJBrowseRoute } from '../config/jbrowseConfig.js';

const HOVER_DETAILS_DEBOUNCE_MS = 180;

function appendMetadataRows(rows, metadata, prefix, limit = 4) {
  if (!metadata || typeof metadata !== 'object') return;
  let count = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined || value === '') continue;
    rows.push({ k: `${prefix} ${key}`, v: formatTooltipValue(value) });
    count += 1;
    if (count >= limit) {
      const remaining = Object.values(metadata).filter((v) => v !== null && v !== undefined && v !== '').length - count;
      if (remaining > 0) rows.push({ k: `${prefix} metadata`, v: `+${remaining} more` });
      break;
    }
  }
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getMutationSelection(mutation) {
  if (!mutation) return null;
  return {
    id: numberOrNull(mutation.mutation_id ?? mutation.id),
    site_id: numberOrNull(mutation.site_id),
    position: numberOrNull(mutation.position_bp ?? mutation.position),
    node_id: numberOrNull(mutation.node_id ?? mutation.node),
    tree_idx: numberOrNull(mutation.tree_idx)
  };
}

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
    loraxSid,
    queryDetails,
    // For tip hover tooltip value computation
    selectedColorBy,
    metadataArrays
  } = useLorax();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [genomicPosition, setGenomicPosition] = useState(null); // [start, end] - synced with deck
  const [statusMessage, setStatusMessage] = useState(null);
  const [showInfo, setShowInfo] = useState(() => searchParams.has('presetfeature'));
  const [showSettings, setShowSettings] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [infoActiveTab, setInfoActiveTab] = useState(() =>
    searchParams.has('presetfeature') ? 'metadata' : 'details'
  );
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

  const canRunTour = Boolean(tsconfig && !loading && !error);

  // Navigation state for mutation tab
  const [clickedGenomeInfo, setClickedGenomeInfo] = useState(null);
  const [highlightedMutationNode, setHighlightedMutationNode] = useState(null);
  const [highlightedMutationTreeIndex, setHighlightedMutationTreeIndex] = useState(null);
  const [hoveredMutationHighlight, setHoveredMutationHighlight] = useState(null);
  const [selectedMutationIdentity, setSelectedMutationIdentity] = useState(null);

  // Right-panel details (populated by queryDetails)
  const [treeDetails, setTreeDetails] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [individualDetails, setIndividualDetails] = useState(null);
  const [populationDetails, setPopulationDetails] = useState(null);
  const [nodeMutations, setNodeMutations] = useState(null);
  const [nodeEdges, setNodeEdges] = useState(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

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
  const [highlightDescendantsOnHover, setHighlightDescendantsOnHover] = useState(false);
  const [descendantsHighlightColor, setDescendantsHighlightColor] = useState([56, 189, 248, 255]);
  // Tree edge color [r, g, b, a] (used when colorEdgesByTree is false)
  const [edgeColor, setEdgeColor] = useState([100, 100, 100, 255]);
  // Default tip color [r, g, b, a] when metadata coloring is unavailable
  const [defaultTipColor, setDefaultTipColor] = useState([150, 150, 150, 200]);
  const [timeScale, setTimeScale] = useState('linear');
  // Controls whether model matrix recomputes on zoom interactions.
  const [lockModelMatrix, setLockModelMatrix] = useState(false);
  // Tracks whether lock view was auto-enabled from showingAllTrees behavior.
  const autoLockModelMatrixRef = useRef(false);
  // User manual OFF should temporarily block auto re-enable until context reset.
  const manualLockOffOverrideRef = useRef(false);
  // One-shot flag: suppress auto-lock on initial load when URL has specific genomic coords.
  const hasInitialUrlCoordsRef = useRef(
    Boolean(searchParams.get('genomiccoordstart') && searchParams.get('genomiccoordend'))
  );
  // Temporary toggle so max zoom guard can be re-enabled quickly.
  const ENABLE_MAX_ZOOM_GUARD = false;
  // Max zoom alert (lock-mode zoom limit reached)
  const [maxZoomAlert, setMaxZoomAlert] = useState(false);

  // Hover tooltip state (rendered in website, not in core)
  const [hoverTooltip, setHoverTooltip] = useState(null); // { kind, x, y, title, rows[] }
  const hoverDetailsCacheRef = useRef(new Map());
  const hoverDetailsTimerRef = useRef(null);
  const activeHoverKeyRef = useRef(null);
  const hoverDetailsRequestSeqRef = useRef(0);

  const clearHoverDetailsTimer = useCallback(() => {
    if (hoverDetailsTimerRef.current != null) {
      clearTimeout(hoverDetailsTimerRef.current);
      hoverDetailsTimerRef.current = null;
    }
  }, []);

  const clearHoverTooltip = useCallback(() => {
    activeHoverKeyRef.current = null;
    clearHoverDetailsTimer();
    setHoveredMutationHighlight(null);
    setHoverTooltip(null);
  }, [clearHoverDetailsTimer]);

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
    const advancedStepsEnabled = false;
    const step = (id, extra) => ({ id, ...viewerTourNarrationById[id], ...extra });

    return [
      step("viewer-position", { target: '[data-tour="viewer-position"]' }),
      step("viewer-reset-view", {
        target: '[data-tour="viewer-reset-view"]',
        offset: { x: 0, y: 20 }
      }),
      step("viewer-compare-topology", {
        target: '[data-tour="viewer-compare-topology"]',
        offset: { x: 0, y: 20 }
      }),
      step("viewer-lock-view", {
        target: '[data-tour="viewer-lock-view"]',
        offset: { x: 0, y: 20 }
      }),
      step("viewer-viewport", { target: '[data-tour="viewer-viewport"]' }),
      step("viewer-pan", {
        target: '[data-tour="viewer-viewport"]',
        animation: {
          label: "Pan gesture",
          mediaType: "gesture",
          gesture: "pan",
          mediaAlt: "One finger drag left and right"
        }
      }),
      step("viewer-zoom", {
        target: '[data-tour="viewer-viewport"]',
        animation: {
          label: "Scroll to zoom",
          mediaType: "gesture",
          gesture: "zoom-both",
          mediaAlt: "Scroll up and down, and Ctrl + scroll up and down"
        }
      }),
      ...(advancedStepsEnabled
        ? [
            step("viewer-tree-polygon", {
              getTargetRect: () => getTourPolygonRect(tourCenterTreeIndex),
              targetKey: tourTargetTick,
              disableNext: !tourPolygonClicked
            }),
            step("viewer-tree-edge", {
              getTargetRect: () => getTourPolygonRect(tourSelectedTreeIndex ?? tourCenterTreeIndex),
              targetKey: tourTargetTick,
              disableNext: !tourEdgeClicked
            })
          ]
        : []),
      step("viewer-info-button", {
        target: '[data-tour="viewer-info-button"]',
        offset: { x: -60, y: -60 },
        arrowDir: "right"
      }),
      ...(advancedStepsEnabled
        ? [
            step("viewer-info-details", {
              target: '[data-tour="viewer-info-details-tab"]',
              offset: { x: 10, y: 20 },
              arrowDir: "up"
            }),
            step("viewer-info-mutations", {
              target: '[data-tour="viewer-info-mutations-tab"]',
              offset: { x: 0, y: 20 },
              arrowDir: "up"
            }),
            step("viewer-info-filter", {
              target: '[data-tour="viewer-info-filter-tab"]',
              offset: { x: 0, y: 20 },
              arrowDir: "up"
            })
          ]
        : []),
      step("viewer-settings-button", {
        target: '[data-tour="viewer-settings-button"]',
        offset: { x: -60, y: -60 },
        arrowDir: "right"
      }),
      step("viewer-screenshot-button", {
        target: '[data-tour="viewer-screenshot-button"]',
        offset: { x: -60, y: -60 },
        arrowDir: "right"
      })
    ];
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
    const xy = getTooltipClientCoords(info, event);
    if (!xy) return;
    const { x, y } = xy;
    setHoverTooltip({ ...base, x, y });
  }, []);

  const buildTipTooltipRows = useCallback((tip, selectedValue, details = null, loadingDetails = false) => {
    const rows = [
      { k: 'Tree', v: tip.tree_idx },
      { k: 'Node ID', v: tip.node_id },
      { k: 'Node time', v: formatTooltipTime(tip.node_time) },
      ...(tip.name ? [{ k: 'Name', v: tip.name }] : []),
      ...(selectedColorBy ? [{ k: selectedColorBy, v: selectedValue ?? '-' }] : [])
    ];

    if (loadingDetails) {
      rows.push({ k: 'Metadata', v: 'Loading...' });
      return rows;
    }

    const node = details?.node;
    if (node) {
      if (node.individual !== undefined && node.individual !== -1) {
        rows.push({ k: 'Individual', v: node.individual });
      }
      if (node.population !== undefined && node.population !== -1) {
        rows.push({ k: 'Population', v: node.population });
      }
      appendMetadataRows(rows, node.metadata, 'Node');
    }

    if (details?.individual) {
      rows.push({ k: 'Individual ID', v: details.individual.id });
      appendMetadataRows(rows, details.individual.metadata, 'Individual');
    }

    if (details?.population) {
      rows.push({ k: 'Population ID', v: details.population.id });
      appendMetadataRows(rows, details.population.metadata, 'Population');
    }

    return rows;
  }, [selectedColorBy]);

  const updateTipTooltipWithDetails = useCallback((hoverKey, tip, selectedValue, details) => {
    setHoverTooltip((current) => {
      if (!current || current.hoverKey !== hoverKey) return current;
      return {
        ...current,
        rows: buildTipTooltipRows(tip, selectedValue, details, false)
      };
    });
  }, [buildTipTooltipRows]);

  const scheduleHoverDetailsFetch = useCallback((hoverKey, tip, selectedValue) => {
    clearHoverDetailsTimer();

    const cached = hoverDetailsCacheRef.current.get(hoverKey);
    if (cached) {
      updateTipTooltipWithDetails(hoverKey, tip, selectedValue, cached);
      return;
    }

    hoverDetailsTimerRef.current = setTimeout(async () => {
      hoverDetailsTimerRef.current = null;
      const requestSeq = ++hoverDetailsRequestSeqRef.current;

      try {
        const details = await queryDetails({
          treeIndex: tip.tree_idx,
          node: tip.node_id,
          comprehensive: true
        });
        hoverDetailsCacheRef.current.set(hoverKey, details);

        if (activeHoverKeyRef.current !== hoverKey || requestSeq !== hoverDetailsRequestSeqRef.current) {
          return;
        }
        updateTipTooltipWithDetails(hoverKey, tip, selectedValue, details);
      } catch (e) {
        console.warn('[FileView] hover details query failed:', e);
      }
    }, HOVER_DETAILS_DEBOUNCE_MS);
  }, [clearHoverDetailsTimer, queryDetails, updateTipTooltipWithDetails]);

  useEffect(() => () => {
    clearHoverDetailsTimer();
  }, [clearHoverDetailsTimer]);

  useEffect(() => {
    hoverDetailsCacheRef.current.clear();
  }, [tsconfig?.file_path, tsconfig?.filename]);

  const resetDetails = useCallback(() => {
    setTreeDetails(null);
    setNodeDetails(null);
    setIndividualDetails(null);
    setPopulationDetails(null);
    setNodeMutations(null);
    setNodeEdges(null);
    setSelectedTipMetadata(null);
    setSelectedMutationIdentity(null);
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
    if (file && project && isConnected && loraxSid && !tsconfig?.filename) {
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
  }, [file, project, sid, genomiccoordstart, genomiccoordend, isConnected, loraxSid, tsconfig?.filename, queryFile, handleConfigUpdate]);

  useEffect(() => {
    if (tourState.hasSeen) return;
    if (canRunTour) {
      setTourOpen(true);
    }
  }, [tourState.hasSeen, canRunTour]);

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

  // Disable lock-view before preset apply (e.g. position preset navigation).
  const handleBeforePresetApply = useCallback(() => {
    if (lockModelMatrix) {
      handleLockModelMatrixChange(false);
    }
  }, [lockModelMatrix, handleLockModelMatrixChange]);

  // Disable lock-view before mutation click navigation (Mutations tab).
  const handleSetClickedGenomeInfo = useCallback((info) => {
    if (lockModelMatrix) {
      handleLockModelMatrixChange(false);
    }
    setClickedGenomeInfo(info);
  }, [lockModelMatrix, handleLockModelMatrixChange]);

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

  useEffect(() => {
    if (hasInitialUrlCoordsRef.current && tsconfig?.file_path) {
      manualLockOffOverrideRef.current = true;
      hasInitialUrlCoordsRef.current = false;
    }
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

    if (lockModelMatrix) return; // no navigation when locked-in

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
  }, [tsconfig?.intervals, tourOpen, tourActiveStepId, lockModelMatrix]);

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
      setIsFetchingDetails(true);
      const details = await queryDetails({ treeIndex: edge.tree_idx });
      applyDetailsResponse(details, edge.tree_idx);
    } catch (e) {
      console.error('[FileView] edge click queryDetails failed:', e);
    } finally {
      setIsFetchingDetails(false);
    }
  }, [tourOpen, tourActiveStepId, tourSelectedTreeIndex, handlePolygonClick, queryDetails, applyDetailsResponse, resetDetails]);

  const handleMutationClick = useCallback(async (mutation) => {
    if (mutation?.tree_idx == null || mutation?.node_id == null) return;
    const selection = getMutationSelection(mutation);

    try {
      setShowInfo(true);
      setInfoActiveTab('details');
      resetDetails();
      setSelectedMutationIdentity(selection);
      setHighlightedMutationNode(String(mutation.node_id));
      setHighlightedMutationTreeIndex(mutation.tree_idx);
      setIsFetchingDetails(true);
      const details = await queryDetails({ treeIndex: mutation.tree_idx });
      applyDetailsResponse(details, mutation.tree_idx);
    } catch (e) {
      console.error('[FileView] mutation click queryDetails failed:', e);
    } finally {
      setIsFetchingDetails(false);
    }
  }, [queryDetails, applyDetailsResponse, resetDetails]);

  const timelineLabel = useMemo(() => {
    const currentFilename = String(tsconfig?.filename || filename || file || '').toLowerCase();
    const isCsvFile = currentFilename.endsWith('.csv') || Boolean(tsconfig?.tree_info);
    return isCsvFile ? 'branch length' : tsconfig?.times?.type;
  }, [file, filename, tsconfig?.filename, tsconfig?.times?.type, tsconfig?.tree_info]);

  const jbrowseRoute = useMemo(() => buildJBrowseRoute({
    project,
    file: filename || file,
    sid,
    genomiccoordstart: genomicPosition?.[0],
    genomiccoordend: genomicPosition?.[1]
  }), [file, filename, genomicPosition, project, sid]);

  const effectiveHighlightedMutationNode = hoveredMutationHighlight?.node_id != null
    ? String(hoveredMutationHighlight.node_id)
    : highlightedMutationNode;
  const effectiveHighlightedMutationTreeIndex = hoveredMutationHighlight?.tree_idx != null
    ? hoveredMutationHighlight.tree_idx
    : highlightedMutationTreeIndex;

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
          timelineLabel={timelineLabel}
          dataTour="viewer-viewport"
        />

        {/* Max zoom alert (lock-mode) */}
        {ENABLE_MAX_ZOOM_GUARD && maxZoomAlert && (
          <ErrorAlert
            message="Maximum zoom reached."
            onDismiss={() => setMaxZoomAlert(false)}
            variant="info"
          />
        )}

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
              highlightedMutationNode={effectiveHighlightedMutationNode}
              highlightedMutationTreeIndex={effectiveHighlightedMutationTreeIndex}
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
              highlightDescendantsOnHover={highlightDescendantsOnHover}
              descendantsHighlightColor={descendantsHighlightColor}
              edgeColor={edgeColor}
              defaultTipColor={defaultTipColor}
              timeScale={timeScale}
              lockModelMatrix={lockModelMatrix}
              enableLockMaxZoomGuard={ENABLE_MAX_ZOOM_GUARD}
              onMaxZoomReached={ENABLE_MAX_ZOOM_GUARD ? () => setMaxZoomAlert(true) : undefined}
              onPolygonClick={handlePolygonClick}
              onTipHover={(tip, info, event) => {
                if (!tip) {
                  clearHoverTooltip();
                  return;
                }
                const hoverKey = `tip:${tip.tree_idx}:${tip.node_id}`;
                activeHoverKeyRef.current = hoverKey;
                const value = getSelectedMetadataValueForNode(tip.node_id);
                const cachedDetails = hoverDetailsCacheRef.current.get(hoverKey);
                setTooltipFromEvent({
                  kind: 'tip',
                  hoverKey,
                  title: 'Tip',
                  rows: buildTipTooltipRows(tip, value, cachedDetails, !cachedDetails)
                }, info, event);
                scheduleHoverDetailsFetch(hoverKey, tip, value);
              }}
              onTipClick={async (tip) => {
                if (tip?.tree_idx == null || tip?.node_id == null) return;
                try {
                  setShowInfo(true);
                  resetDetails();
                  setIsFetchingDetails(true);
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
                } finally {
                  setIsFetchingDetails(false);
                }
              }}
              onEdgeHover={(edge, info, event) => {
                if (!edge) {
                  clearHoverTooltip();
                  return;
                }
                activeHoverKeyRef.current = null;
                clearHoverDetailsTimer();
                setTooltipFromEvent({
                  kind: 'edge',
                  title: 'Edge',
                  rows: [
                    { k: 'Tree', v: edge.tree_idx },
                    { k: 'Parent', v: edge.parent_id },
                    { k: 'Parent time', v: formatTooltipTime(edge.parent_time) },
                    { k: 'Child', v: edge.child_id },
                    { k: 'Child time', v: formatTooltipTime(edge.child_time) }
                  ]
                }, info, event);
              }}
              onMutationHover={(mutation, info, event) => {
                if (!mutation) {
                  setHoveredMutationHighlight(null);
                  clearHoverTooltip();
                  return;
                }
                activeHoverKeyRef.current = null;
                clearHoverDetailsTimer();
                setHoveredMutationHighlight(getMutationSelection(mutation));
                const stateChange = mutation.inherited_state || mutation.derived_state
                  ? `${mutation.inherited_state || mutation.ancestral_state || '?'} → ${mutation.derived_state || '?'}`
                  : '-';
                setTooltipFromEvent({
                  kind: 'mutation',
                  title: 'Mutation',
                  rows: [
                    { k: 'Tree', v: mutation.tree_idx },
                    { k: 'Mutation ID', v: mutation.mutation_id ?? '-' },
                    { k: 'Site ID', v: mutation.site_id ?? '-' },
                    { k: 'Position', v: Number.isFinite(Number(mutation.position_bp)) ? Math.round(Number(mutation.position_bp)) : '-' },
                    { k: 'Node ID', v: mutation.node_id ?? '-' },
                    { k: 'Node time', v: formatTooltipTime(mutation.node_time) },
                    { k: 'Mutation time', v: formatTooltipTime(mutation.mutation_time) },
                    { k: 'Change', v: stateChange }
                  ]
                }, info, event);
              }}
              onMutationClick={handleMutationClick}
              onEdgeClick={handleEdgeClick}
            />

            <HoverTooltip tooltip={hoverTooltip} />
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
            setClickedGenomeInfo={handleSetClickedGenomeInfo}
            setHighlightedMutationNode={setHighlightedMutationNode}
            setHighlightedMutationTreeIndex={setHighlightedMutationTreeIndex}
            treeDetails={treeDetails}
            nodeDetails={nodeDetails}
            individualDetails={individualDetails}
            populationDetails={populationDetails}
            nodeMutations={nodeMutations}
            nodeEdges={nodeEdges}
            selectedTipMetadata={selectedTipMetadata}
            selectedMutationIdentity={selectedMutationIdentity}
            setSelectedMutationIdentity={setSelectedMutationIdentity}
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
            onBeforePresetApply={handleBeforePresetApply}
            isFetchingDetails={isFetchingDetails}
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
            highlightDescendantsOnHover={highlightDescendantsOnHover}
            setHighlightDescendantsOnHover={setHighlightDescendantsOnHover}
            descendantsHighlightColor={descendantsHighlightColor}
            setDescendantsHighlightColor={setDescendantsHighlightColor}
            edgeColor={edgeColor}
            setEdgeColor={setEdgeColor}
            defaultTipColor={defaultTipColor}
            setDefaultTipColor={setDefaultTipColor}
            timeScale={timeScale}
            setTimeScale={setTimeScale}
          />
        </div>
      )}

      {/* Right: icon bar - always visible, side-by-side */}
      <div className="flex-shrink-0 w-8 bg-slate-900 border-l border-slate-800 text-slate-400 z-[101] flex flex-col items-center py-4 shadow-2xl">
        <div className="flex flex-col items-center space-y-4">
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
            data-tour="viewer-screenshot-button"
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

          {/* JBrowse button */}
          <a
            href={jbrowseRoute}
            className="group relative p-2 rounded-lg transition-colors hover:bg-slate-800 hover:text-white"
            title="Open in JBrowse"
            aria-label="Open in JBrowse"
          >
            <LuDna className="h-5 w-5" aria-hidden="true" />
            <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Open in JBrowse
            </span>
          </a>
        </div>

        {/* Tutorial button (bottom) */}
        <div className="mt-auto pt-4 flex flex-col items-center">
          <button
            onClick={() => {
              if (!canRunTour) return;
              setShowInfo(false);
              setShowSettings(false);
              setTourOpen(true);
            }}
            disabled={!canRunTour}
            className={`group relative p-2 rounded-lg transition-colors ${
              tourOpen
                ? 'bg-emerald-600 text-white'
                : 'hover:bg-slate-800 hover:text-white'
            } ${canRunTour ? '' : 'opacity-40 cursor-not-allowed'}`}
            title="Tutorial"
            aria-label="Tutorial"
          >
            <span className="h-5 w-5 flex items-center justify-center text-base font-bold leading-none">?</span>
            <span className="absolute left-full ml-2 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Tutorial
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default FileView;
