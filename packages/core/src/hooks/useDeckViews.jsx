import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { OrthographicView } from '@deck.gl/core';
import { MyOrthographicController } from '../controllers/MyOrthographicController.js';
import { INITIAL_VIEW_STATE, VIEW_ID_MAP, CONFIG_KEY_MAP } from '../constants/deckViews.js';
import { getPanStep } from '../utils/viewStateUtils.js';
import { useGenomicCoordinates } from './useGenomicCoordinates.jsx';

/**
 * Hook for managing deck.gl views, view state, and view state synchronization
 *
 * @param {Object} params
 * @param {Object} params.viewConfig - Merged view configuration
 * @param {string[]} params.enabledViews - Array of enabled view IDs
 * @param {string} params.zoomAxis - Current zoom axis ('X', 'Y', or 'all')
 * @param {string|null} params.panDirection - Current pan direction ('L', 'R', or null)
 * @param {number} params.globalBpPerUnit - Base pairs per world unit (from config)
 * @param {number} params.genomeLength - Total genome length in base pairs (from config)
 * @param {[number, number]} params.tsconfigValue - Backend's initial_position [startBp, endBp]
 * @returns {Object} View management state and functions
 */
export function useDeckViews({
  viewConfig,
  enabledViews,
  zoomAxis,
  panDirection,
  globalBpPerUnit = null,
  genomeLength = null,
  tsconfigValue = null
}) {
  const [decksize, setDecksize] = useState(null);
  const [xzoom, setXzoom] = useState(INITIAL_VIEW_STATE.ortho.zoom[0]);
  const [yzoom, setYzoom] = useState(INITIAL_VIEW_STATE.ortho.zoom[1]);

  // Track if initial viewState from URL/tsconfig has been applied
  const urlInitialized = useRef(false);

  /**
   * Create initial view state for all enabled views
   */
  const initialViewState = useMemo(() => {
    const state = {};

    enabledViews.forEach(viewId => {
      if (INITIAL_VIEW_STATE[viewId]) {
        state[viewId] = { ...INITIAL_VIEW_STATE[viewId] };
      }
    });

    return state;
  }, [enabledViews]);

  const [viewState, setViewState] = useState(initialViewState);

  // Initialize viewState when decksize becomes available
  // Note: This only runs if viewState is empty AND we're not going to apply URL/tsconfig coords
  useEffect(() => {
    if (decksize && Object.keys(viewState).length === 0 && !urlInitialized.current) {
      setViewState(initialViewState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decksize, initialViewState]);

  // =========================================================================
  // Genomic Coordinates Integration
  // =========================================================================

  // Check if coordinate management is enabled
  const coordsEnabled = !!(globalBpPerUnit && genomeLength && decksize?.width);

  // Use the genomic coordinates hook
  const {
    genomicCoords,
    setGenomicCoords: setGenomicCoordsInternal,
    initialViewState: genomicInitialViewState,
    genomicToWorld: genomicToWorldBound,
    worldToGenomic: worldToGenomicBound,
    isReady: coordsReady
  } = useGenomicCoordinates({
    viewState: viewState?.ortho,
    deckWidth: decksize?.width,
    globalBpPerUnit,
    genomeLength,
    tsconfigValue,
    enabled: coordsEnabled
  });

  // Apply initial viewState from URL/tsconfig (once)
  useEffect(() => {
    if (!genomicInitialViewState || urlInitialized.current) return;
    if (!decksize) return; // Wait for deck to be sized

    setViewState(prev => {
      const { target, zoom } = genomicInitialViewState;

      const newState = { ...prev };

      // Apply to ortho view
      if (prev['ortho']) {
        newState['ortho'] = {
          ...prev['ortho'],
          target: [target[0], prev['ortho'].target?.[1] ?? target[1]],
          zoom: [zoom[0], prev['ortho'].zoom?.[1] ?? zoom[1]]
        };
      }

      // Sync genome-positions
      if (prev['genome-positions']) {
        newState['genome-positions'] = {
          ...prev['genome-positions'],
          target: [target[0], prev['genome-positions'].target?.[1] || 1],
          zoom: [zoom[0], prev['genome-positions'].zoom?.[1] || 8]
        };
      }

      // Sync genome-info
      if (prev['genome-info']) {
        newState['genome-info'] = {
          ...prev['genome-info'],
          target: [target[0], prev['genome-info'].target?.[1] || 1],
          zoom: [zoom[0], prev['genome-info'].zoom?.[1] || 8]
        };
      }

      return newState;
    });

    // Update zoom tracking
    setXzoom(genomicInitialViewState.zoom[0]);

    urlInitialized.current = true;
  }, [genomicInitialViewState, decksize]);

  // Wrapper to set genomic coords and update viewState
  const setGenomicCoords = useCallback((coords) => {
    const viewStateUpdate = setGenomicCoordsInternal(coords);

    if (viewStateUpdate) {
      const { target, zoom } = viewStateUpdate;

      setViewState(prev => {
        const newState = { ...prev };

        // Apply to ortho view
        if (prev['ortho']) {
          newState['ortho'] = {
            ...prev['ortho'],
            target: [target[0], prev['ortho'].target?.[1] ?? target[1]],
            zoom: [zoom[0], prev['ortho'].zoom?.[1] ?? zoom[1]]
          };
        }

        // Sync genome-positions
        if (prev['genome-positions']) {
          newState['genome-positions'] = {
            ...prev['genome-positions'],
            target: [target[0], prev['genome-positions'].target?.[1] || 1],
            zoom: [zoom[0], prev['genome-positions'].zoom?.[1] || 8]
          };
        }

        // Sync genome-info
        if (prev['genome-info']) {
          newState['genome-info'] = {
            ...prev['genome-info'],
            target: [target[0], prev['genome-info'].target?.[1] || 1],
            zoom: [zoom[0], prev['genome-info'].zoom?.[1] || 8]
          };
        }

        return newState;
      });

      // Update zoom tracking
      setXzoom(zoom[0]);
    }
  }, [setGenomicCoordsInternal]);

  /**
   * Create OrthographicView instances for enabled views
   */
  const views = useMemo(() => {
    const viewInstances = [];

    enabledViews.forEach(viewId => {
      const configKey = CONFIG_KEY_MAP[viewId];
      const config = viewConfig[configKey];

      if (!config?.enabled) return;

      const viewOptions = {
        id: viewId,
        x: config.x,
        y: config.y,
        width: config.width,
        height: config.height,
        initialViewState: INITIAL_VIEW_STATE[viewId]
      };

      // Only ortho view gets the controller
      if (viewId === 'ortho') {
        viewOptions.controller = {
          type: MyOrthographicController,
          scrollZoom: { smooth: true, zoomAxis },
          dragPan: true,
        };
      } else {
        viewOptions.controller = false;
      }

      viewInstances.push(new OrthographicView(viewOptions));
    });

    return viewInstances;
  }, [viewConfig, enabledViews, zoomAxis]);

  /**
   * Handle view state changes with synchronization logic
   * - Genome views (genome-positions, genome-info) sync X-axis with ortho
   * - Tree-time view syncs Y-axis with ortho
   */
  const handleViewStateChange = useCallback(({ viewState: newViewState, viewId, oldViewState }) => {
    if (!viewId || !newViewState || !oldViewState) return;


    setViewState((prev) => {
      let zoom = [...(oldViewState?.zoom || [0, 0])];
      let target = [...(oldViewState?.target || [0, 0])];

      // Handle zoom based on axis
      if (panDirection === null) {
        if (zoomAxis === 'Y') {
          zoom[1] = newViewState.zoom[1];
          target[1] = newViewState.target[1];
          zoom[0] = oldViewState.zoom[0];
          target[0] = oldViewState.target[0];
        } else if (zoomAxis === 'X') {
          zoom[0] = newViewState.zoom[0];
          target[0] = newViewState.target[0];
          zoom[1] = oldViewState.zoom[1];
          target[1] = oldViewState.target[1];
        }
      } else if (panDirection === 'L') {
        // Pan left
        const panStep = getPanStep({
          zoomX: zoom[0],
          baseStep: 8,
          sensitivity: zoom[0] >= 8 || zoom[0] < 0 ? 0.9 : 0.7
        });
        target[0] = target[0] - panStep;
      } else if (panDirection === 'R') {
        // Pan right
        const panStep = getPanStep({
          zoomX: zoom[0],
          baseStep: 8,
          sensitivity: zoom[0] >= 8 || zoom[0] < 0 ? 0.9 : 0.7
        });
        target[0] = target[0] + panStep;
      } else {
        // Default: use new values
        zoom = newViewState.zoom;
        target = [newViewState.target[0], oldViewState.target[1]];
      }

      // Bound y-limit to [0, 1]
      if (target[1] < 0 || target[1] > 1) {
        target[1] = oldViewState.target[1];
        zoom[1] = oldViewState.zoom[1];
      }

      // Build new view states
      const newViewStates = {
        ...prev,
        [viewId]: {
          ...prev[viewId],
          zoom,
          target,
        }
      };

      // Update zoom tracking
      setXzoom(zoom[0]);
      setYzoom(zoom[1]);

      // Sync genome-positions X-axis with ortho
      if (prev['genome-positions']) {
        newViewStates['genome-positions'] = {
          ...prev['genome-positions'],
          target: [target[0], prev['genome-positions'].target?.[1] || 0],
          zoom: [zoom[0], prev['genome-positions'].zoom?.[1]]
        };
      }

      // Sync genome-info X-axis with ortho
      if (prev['genome-info']) {
        newViewStates['genome-info'] = {
          ...prev['genome-info'],
          target: [target[0], prev['genome-info'].target?.[1] || 0],
          zoom: [zoom[0], prev['genome-info'].zoom?.[1]]
        };
      }

      // Sync tree-time Y-axis with ortho
      if (prev['tree-time']) {
        newViewStates['tree-time'] = {
          ...prev['tree-time'],
          target: [prev['tree-time'].target?.[0], target[1]],
          zoom: [prev['tree-time'].zoom?.[0], zoom[1]]
        };
      }

      return newViewStates;
    });
  }, [zoomAxis, panDirection]);

  /**
   * Reset view to initial Y position (keep X position)
   */
  const viewReset = useCallback(() => {
    setViewState(prev => {
      const newState = { ...prev };

      if (prev['ortho']) {
        newState['ortho'] = {
          ...prev['ortho'],
          zoom: [prev['ortho'].zoom[0], INITIAL_VIEW_STATE['ortho'].zoom[1]],
          target: [prev['ortho'].target[0], INITIAL_VIEW_STATE['ortho'].target[1]]
        };
      }

      if (prev['genome-positions']) {
        newState['genome-positions'] = {
          ...prev['genome-positions'],
          zoom: [prev['genome-positions'].zoom[0], INITIAL_VIEW_STATE['genome-positions'].zoom[1]],
          target: [prev['genome-positions'].target[0], INITIAL_VIEW_STATE['genome-positions'].target[1]]
        };
      }

      if (prev['tree-time']) {
        newState['tree-time'] = {
          ...prev['tree-time'],
          zoom: [prev['tree-time'].zoom[0], INITIAL_VIEW_STATE['tree-time'].zoom[1]],
          target: [prev['tree-time'].target[0], INITIAL_VIEW_STATE['tree-time'].target[1]]
        };
      }

      if (prev['genome-info']) {
        newState['genome-info'] = {
          ...prev['genome-info'],
          zoom: [prev['genome-info'].zoom[0], INITIAL_VIEW_STATE['genome-info'].zoom[1]],
          target: [prev['genome-info'].target[0], INITIAL_VIEW_STATE['genome-info'].target[1]]
        };
      }

      return newState;
    });

    setYzoom(INITIAL_VIEW_STATE['ortho'].zoom[1]);
  }, []);

  return {
    // Existing view management
    views,
    viewState,
    setViewState,
    handleViewStateChange,
    decksize,
    setDecksize,
    xzoom,
    yzoom,
    setYzoom,
    viewReset,

    // Genomic coordinates (new)
    genomicCoords,          // [startBp, endBp] | null
    setGenomicCoords,       // (coords: [number, number]) => void
    genomicToWorld: genomicToWorldBound,  // (coords) => viewState | null
    worldToGenomic: worldToGenomicBound,  // () => [startBp, endBp] | null
    coordsReady             // boolean - whether coordinate conversion is available
  };
}
