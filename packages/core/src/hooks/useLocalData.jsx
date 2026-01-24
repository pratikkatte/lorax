import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  queryLocalDataSync,
  serializeBinsForTransfer,
  supportsWebWorkers
} from '../utils/computations.js';

// Compare arrays to avoid unnecessary state updates
function arraysEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Deserialize bins from worker
 * Reconstructs Map and Matrix4 from serialized format
 */
function deserializeBins(serialized) {
  if (!serialized || !Array.isArray(serialized)) return null;
  const map = new Map();
  for (const item of serialized) {
    const { key, ...rest } = item;
    map.set(key, {
      ...rest,
      // Keep modelMatrix as array - consumer can convert to Matrix4 if needed
      // This avoids requiring @math.gl/core as a dependency
      modelMatrix: rest.modelMatrix
    });
  }
  return map;
}

/**
 * Hook to compute local bins and tree positioning based on intervals.
 * Receives pre-decimation intervals from useInterval.
 *
 * Supports two execution modes:
 * - 'worker': Uses web worker for computation (Vite)
 * - 'main-thread': Uses synchronous computation (webpack/non-Vite)
 * - 'auto': Detects environment and chooses appropriate mode
 *
 * NOTE: This hook executes immediately without debounce.
 * Debouncing should be applied at the viewport/genomicCoords level (useInterval)
 * to ensure atomic processing and prevent race conditions.
 *
 * @param {Object} params
 * @param {Object} params.worker - Worker instance from useWorker (required for 'worker' mode)
 * @param {boolean} params.workerConfigReady - Whether worker has config (required for 'worker' mode)
 * @param {number[]} params.allIntervalsInView - Pre-decimation intervals from useInterval
 * @param {Object} params.intervalBounds - { lo, hi } global index bounds from useInterval
 * @param {[number, number]} params.genomicCoords - [startBp, endBp] viewport bounds
 * @param {Object} params.viewState - deck.gl viewState with zoom
 * @param {Object} params.tsconfig - { genome_length, intervals[] }
 * @param {Object} params.displayOptions - { selectionStrategy }
 * @param {string} params.mode - Execution mode: 'worker' | 'main-thread' | 'auto' (default: 'auto')
 * @returns {Object} { localBins, displayArray, isReady, showingAllTrees, reset }
 */
export function useLocalData({
  worker,
  workerConfigReady,
  allIntervalsInView,
  intervalBounds = { lo: 0, hi: 0 },
  genomicCoords,
  viewState,
  tsconfig,
  displayOptions = {},
  mode = 'auto'
}) {
  const [localBins, setLocalBins] = useState(null);
  const [displayArray, setDisplayArray] = useState([]);
  const [showingAllTrees, setShowingAllTrees] = useState(false);

  const latestRequestId = useRef(0);

  // Determine effective mode
  const effectiveMode = useMemo(() => {
    if (mode === 'worker') return 'worker';
    if (mode === 'main-thread') return 'main-thread';
    // Auto mode: use worker if available, otherwise main-thread
    return supportsWebWorkers() && worker ? 'worker' : 'main-thread';
  }, [mode, worker]);

  // Serialize displayOptions to avoid object reference comparison issues
  const displayOptionsKey = JSON.stringify(displayOptions);

  // Compute scale factors from viewState
  const globalBpPerUnit = useMemo(() => {
    if (!tsconfig?.genome_length || !tsconfig?.intervals?.length) return null;
    return tsconfig.genome_length / tsconfig.intervals.length;
  }, [tsconfig]);

  const new_globalBp = useMemo(() => {
    // viewState is multi-view: { ortho: {...}, 'genome-info': {...}, ... }
    // Get zoom from the main ortho view
    const orthoZoom = viewState?.ortho?.zoom;
    if (!globalBpPerUnit || orthoZoom == null) return null;
    const xZoom = Array.isArray(orthoZoom) ? orthoZoom[0] : orthoZoom;
    const baseZoom = 8;
    const zoomDiff = xZoom - baseZoom;
    const scaleFactor = Math.pow(2, -zoomDiff);
    return globalBpPerUnit * scaleFactor;
  }, [globalBpPerUnit, viewState]);

  // Worker mode effect - executes immediately (no debounce)
  useEffect(() => {
    if (effectiveMode !== 'worker') return;
    if (!workerConfigReady || !genomicCoords || !worker || !globalBpPerUnit || !new_globalBp) return;
    if (!allIntervalsInView || allIntervalsInView.length === 0) return;

    const [start, end] = genomicCoords;
    const requestId = ++latestRequestId.current;

    (async () => {
      try {
        const result = await worker.queryLocalData({
          intervals: allIntervalsInView,
          lo: intervalBounds.lo,
          start,
          end,
          globalBpPerUnit,
          new_globalBp,
          genome_length: tsconfig.genome_length,
          displayOptions : { ...displayOptions, showing_all_trees: showingAllTrees }
        });

        if (requestId !== latestRequestId.current) return;

        setLocalBins(deserializeBins(result.local_bins));
        setDisplayArray(prev => {
          const newArr = result.displayArray || [];
          return arraysEqual(prev, newArr) ? prev : newArr;
        });
        setShowingAllTrees(result.showing_all_trees || false);
      } catch (error) {
        console.error('Failed to query local data:', error);
      }
    })();
  }, [effectiveMode, workerConfigReady, genomicCoords, worker, globalBpPerUnit, new_globalBp, allIntervalsInView, intervalBounds, displayOptionsKey, tsconfig]);

  // Main-thread mode effect - executes immediately (no debounce)
  useEffect(() => {
    if (effectiveMode !== 'main-thread') return;
    if (!genomicCoords || !globalBpPerUnit || !new_globalBp) return;
    if (!allIntervalsInView || allIntervalsInView.length === 0) return;

    const [start, end] = genomicCoords;
    const requestId = ++latestRequestId.current;

    try {
      // Synchronous computation on main thread
      const result = queryLocalDataSync({
        intervals: allIntervalsInView,
        lo: intervalBounds.lo,
        start,
        end,
        globalBpPerUnit,
        new_globalBp,
        genome_length: tsconfig.genome_length,
        displayOptions
      });

      if (requestId !== latestRequestId.current) return;

      // Result is already a Map, no need to deserialize
      setLocalBins(result.local_bins);
      setDisplayArray(prev => {
        const newArr = result.displayArray || [];
        return arraysEqual(prev, newArr) ? prev : newArr;
      });
      setShowingAllTrees(result.showing_all_trees || false);
    } catch (error) {
      console.error('Failed to compute local data:', error);
    }
  }, [effectiveMode, genomicCoords, globalBpPerUnit, new_globalBp, allIntervalsInView, intervalBounds, displayOptionsKey, tsconfig]);

  const reset = useCallback(() => {
    setLocalBins(null);
    setDisplayArray([]);
    setShowingAllTrees(false);
  }, []);

  // Determine isReady based on mode
  const isReady = useMemo(() => {
    if (effectiveMode === 'worker') {
      return workerConfigReady && !!globalBpPerUnit;
    }
    // Main-thread mode just needs globalBpPerUnit
    return !!globalBpPerUnit;
  }, [effectiveMode, workerConfigReady, globalBpPerUnit]);

  return useMemo(() => ({
    localBins,
    displayArray,
    showingAllTrees,
    isReady,
    effectiveMode, // Expose which mode is being used
    reset
  }), [localBins, displayArray, showingAllTrees, isReady, effectiveMode, reset]);
}
