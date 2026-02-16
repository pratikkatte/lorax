import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const DEBUG_LOCAL_DATA_PERF = Boolean(globalThis?.__LORAX_PERF_DEBUG__);
const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

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
 * Reconstructs Map and model matrices from serialized format.
 */
function deserializeBins(serialized) {
  if (!serialized || !Array.isArray(serialized)) return null;
  const map = new Map();
  for (const item of serialized) {
    const { key, ...rest } = item;
    map.set(key, {
      ...rest,
      // Keep modelMatrix as a plain array. Consumers can promote if needed.
      modelMatrix: rest.modelMatrix
    });
  }
  return map;
}

/**
 * Hook to compute local bins and tree positioning based on interval bounds.
 * Receives global index bounds from useInterval and resolves interval data in the worker.
 *
 * NOTE: This hook executes immediately without debounce.
 * Debouncing should be applied at the viewport/genomicCoords level (useInterval)
 * to ensure atomic processing and prevent race conditions.
 *
 * @param {Object} params
 * @param {Object} params.worker - Worker instance from useWorker
 * @param {boolean} params.workerConfigReady - Whether worker has config
 * @param {Object} params.intervalBounds - { lo, hi } global index bounds from useInterval
 * @param {[number, number]} params.genomicCoords - [startBp, endBp] viewport bounds
 * @param {Object} params.viewState - deck.gl viewState with zoom
 * @param {Object} params.tsconfig - { genome_length, intervals[] }
 * @param {Object} params.displayOptions - { selectionStrategy, lockModelMatrix }
 * @returns {Object} { localBins, displayArray, isReady, showingAllTrees, reset }
 */
export function useLocalData({
  worker,
  workerConfigReady,
  intervalBounds = { lo: 0, hi: 0 },
  intervalsCoords = null,
  genomicCoords,
  viewState,
  tsconfig,
  displayOptions = {}
}) {
  const [localBins, setLocalBins] = useState(null);
  const [displayArray, setDisplayArray] = useState([]);
  const [showingAllTrees, setShowingAllTrees] = useState(false);

  const latestRequestId = useRef(0);
  const prevLiveXZoomRef = useRef(null);
  const prevGenomicCoordsRef = useRef(null);
  const lockWasEnabledRef = useRef(false);
  const lockedWindowRef = useRef(null);
  const lockedXZoomRef = useRef(null);
  const zoomDirtyRef = useRef(false);

  // Serialize displayOptions to avoid object reference comparison issues
  const displayOptionsKey = JSON.stringify(displayOptions);
  const lockModelMatrix = !!displayOptions?.lockModelMatrix;

  // Compute scale factors from viewState
  const globalBpPerUnit = useMemo(() => {
    if (!tsconfig?.genome_length || !tsconfig?.intervals?.length) return null;
    return tsconfig.genome_length / tsconfig.intervals.length;
  }, [tsconfig]);

  const getCurrentXZoom = useCallback(() => {
    const orthoZoom = viewState?.ortho?.zoom;
    if (orthoZoom == null) return null;
    return Array.isArray(orthoZoom) ? orthoZoom[0] : orthoZoom;
  }, [viewState]);

  const computeNewGlobalBp = useCallback(() => {
    if (!globalBpPerUnit) return null;
    const liveXZoom = getCurrentXZoom();
    const effectiveXZoom = lockModelMatrix && Number.isFinite(lockedXZoomRef.current)
      ? lockedXZoomRef.current
      : liveXZoom;
    if (!Number.isFinite(effectiveXZoom)) return null;

    const baseZoom = 8;
    const zoomDiff = effectiveXZoom - baseZoom;
    const scaleFactor = Math.pow(2, -zoomDiff);
    return globalBpPerUnit * scaleFactor;
  }, [globalBpPerUnit, getCurrentXZoom, lockModelMatrix]);

  const shouldSkipForLockedInteraction = useCallback((hasLocalBins) => {
    const EPSILON = 1e-9;
    const liveXZoom = getCurrentXZoom();
    const hasLiveXZoom = Number.isFinite(liveXZoom);

    // Track genomic window deltas to distinguish unchanged effect reruns from true pan movement.
    const currentCoords = genomicCoords;
    const prevCoords = prevGenomicCoordsRef.current;
    const hasCurrentCoords = Array.isArray(currentCoords) && currentCoords.length === 2;
    const hasPrevCoords = Array.isArray(prevCoords) && prevCoords.length === 2;
    const coordsChanged = hasCurrentCoords && hasPrevCoords
      && (currentCoords[0] !== prevCoords[0] || currentCoords[1] !== prevCoords[1]);

    if (hasCurrentCoords) {
      prevGenomicCoordsRef.current = [currentCoords[0], currentCoords[1]];
    }

    // Unlocked: clear all lock snapshots and process normally.
    if (!lockModelMatrix) {
      lockWasEnabledRef.current = false;
      lockedWindowRef.current = null;
      lockedXZoomRef.current = null;
      zoomDirtyRef.current = false;
      if (hasLiveXZoom) {
        prevLiveXZoomRef.current = liveXZoom;
      }
      return false;
    }

    // Just enabled: snapshot lock baseline, avoid immediate recompute if we already have data.
    if (!lockWasEnabledRef.current) {
      lockWasEnabledRef.current = true;
      if (hasCurrentCoords) {
        lockedWindowRef.current = [currentCoords[0], currentCoords[1]];
      }
      if (hasLiveXZoom) {
        lockedXZoomRef.current = liveXZoom;
        prevLiveXZoomRef.current = liveXZoom;
      }
      zoomDirtyRef.current = false;
      return !!hasLocalBins;
    }

    // Detect live zoom changes while locked.
    let liveZoomChanged = false;
    const prevLiveXZoom = prevLiveXZoomRef.current;
    if (
      hasLiveXZoom
      && Number.isFinite(prevLiveXZoom)
      && Math.abs(liveXZoom - prevLiveXZoom) > EPSILON
    ) {
      liveZoomChanged = true;
      zoomDirtyRef.current = true;
    }
    if (hasLiveXZoom) {
      prevLiveXZoomRef.current = liveXZoom;
    }

    if (!Array.isArray(lockedWindowRef.current) || lockedWindowRef.current.length !== 2) {
      if (hasCurrentCoords) {
        lockedWindowRef.current = [currentCoords[0], currentCoords[1]];
      }
      return true;
    }

    const [lockedStart, lockedEnd] = lockedWindowRef.current;
    const outsideLockedWindow = hasCurrentCoords
      && (currentCoords[0] < lockedStart - EPSILON || currentCoords[1] > lockedEnd + EPSILON);

    // Inside lock snapshot: never recompute/fetch while locked.
    if (!outsideLockedWindow) return true;

    // After a zoom, require pan-driven movement (coordsChanged) with stable zoom
    // before allowing updates again.
    if (zoomDirtyRef.current) {
      if (!liveZoomChanged && coordsChanged && hasCurrentCoords) {
        zoomDirtyRef.current = false;
        lockedWindowRef.current = [currentCoords[0], currentCoords[1]];
        return false;
      }
      return true;
    }

    // Pan outside lock window without zoom involvement: allow update and move baseline.
    if (!coordsChanged || !hasCurrentCoords) return true;
    lockedWindowRef.current = [currentCoords[0], currentCoords[1]];
    return false;
  }, [lockModelMatrix, getCurrentXZoom, genomicCoords]);

  // Reset zoom tracking when file/config changes to avoid stale lock baselines.
  useEffect(() => {
    prevLiveXZoomRef.current = null;
    prevGenomicCoordsRef.current = null;
    lockWasEnabledRef.current = false;
    lockedWindowRef.current = null;
    lockedXZoomRef.current = null;
    zoomDirtyRef.current = false;
  }, [tsconfig?.file_path, tsconfig?.genome_length]);

  useEffect(() => {
    if (!worker) return;
    if (!workerConfigReady || !genomicCoords || !globalBpPerUnit) return;
    if (intervalBounds.hi <= intervalBounds.lo) return;
    if (!intervalsCoords || intervalsCoords[0] !== genomicCoords[0] || intervalsCoords[1] !== genomicCoords[1]) return;
    if (shouldSkipForLockedInteraction(!!localBins)) return;

    const newGlobalBp = computeNewGlobalBp();
    if (!newGlobalBp) return;

    const [start, end] = genomicCoords;
    const requestId = ++latestRequestId.current;
    const startedAt = now();
    const intervalCount = Math.max(0, (intervalBounds.hi ?? 0) - (intervalBounds.lo ?? 0));

    (async () => {
      try {
        const result = await worker.request('local-data', {
          lo: intervalBounds.lo,
          hi: intervalBounds.hi,
          start,
          end,
          globalBpPerUnit,
          new_globalBp: newGlobalBp,
          genome_length: tsconfig.genome_length,
          displayOptions: { ...displayOptions, showing_all_trees: showingAllTrees }
        });

        if (requestId !== latestRequestId.current) return;

        setLocalBins(deserializeBins(result.local_bins));
        setDisplayArray(prev => {
          const newArr = result.displayArray || [];
          return arraysEqual(prev, newArr) ? prev : newArr;
        });
        setShowingAllTrees(result.showing_all_trees || false);

        if (DEBUG_LOCAL_DATA_PERF) {
          const elapsedMs = Number((now() - startedAt).toFixed(2));
          console.debug('[lorax-perf] local-data', {
            elapsedMs,
            intervalCount,
            displayCount: result?.displayArray?.length ?? 0,
            lo: intervalBounds.lo,
            hi: intervalBounds.hi
          });
        }
      } catch (error) {
        console.error('Failed to query local data:', error);
      }
    })();
  }, [workerConfigReady, genomicCoords, worker, globalBpPerUnit, intervalBounds, displayOptionsKey, tsconfig, shouldSkipForLockedInteraction, computeNewGlobalBp]);

  const reset = useCallback(() => {
    setLocalBins(null);
    setDisplayArray([]);
    setShowingAllTrees(false);
    prevLiveXZoomRef.current = null;
    prevGenomicCoordsRef.current = null;
    lockWasEnabledRef.current = false;
    lockedWindowRef.current = null;
    lockedXZoomRef.current = null;
    zoomDirtyRef.current = false;
  }, []);

  const isReady = useMemo(
    () => workerConfigReady && !!globalBpPerUnit && !!worker,
    [workerConfigReady, globalBpPerUnit, worker]
  );

  return useMemo(() => ({
    localBins,
    displayArray,
    showingAllTrees,
    isReady,
    reset
  }), [localBins, displayArray, showingAllTrees, isReady, reset]);
}
