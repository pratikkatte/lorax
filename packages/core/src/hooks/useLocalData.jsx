import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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
 * @param {Object} params
 * @param {Object} params.worker - Worker instance from useWorker
 * @param {boolean} params.workerConfigReady - Whether worker has config
 * @param {number[]} params.allIntervalsInView - Pre-decimation intervals from useInterval
 * @param {Object} params.intervalBounds - { lo, hi } global index bounds from useInterval
 * @param {[number, number]} params.genomicCoords - [startBp, endBp] viewport bounds
 * @param {Object} params.viewState - deck.gl viewState with zoom
 * @param {Object} params.tsconfig - { genome_length, intervals[] }
 * @param {Object} params.displayOptions - { selectionStrategy }
 * @param {number} params.debounceMs - Debounce delay (default: 100)
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
  debounceMs = 100
}) {
  const [localBins, setLocalBins] = useState(null);
  const [displayArray, setDisplayArray] = useState([]);
  const [showingAllTrees, setShowingAllTrees] = useState(false);

  const debounceTimer = useRef(null);
  const latestRequestId = useRef(0);

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

  useEffect(() => {
    if (!workerConfigReady || !genomicCoords || !worker || !globalBpPerUnit || !new_globalBp) return;
    if (!allIntervalsInView || allIntervalsInView.length === 0) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      const [start, end] = genomicCoords;
      const requestId = ++latestRequestId.current;

      try {
        const result = await worker.queryLocalData({
          intervals: allIntervalsInView,  // Pass intervals from useInterval
          lo: intervalBounds.lo,          // Global start index
          start,
          end,
          globalBpPerUnit,
          new_globalBp,
          genome_length: tsconfig.genome_length,
          displayOptions
        });

        if (requestId !== latestRequestId.current) return;

        setLocalBins(deserializeBins(result.local_bins));
        setDisplayArray(result.displayArray || []);
        setShowingAllTrees(result.showing_all_trees || false);
      } catch (error) {
        console.error('Failed to query local data:', error);
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [workerConfigReady, genomicCoords, worker, globalBpPerUnit, new_globalBp, allIntervalsInView, intervalBounds, displayOptionsKey, debounceMs, tsconfig]);

  const reset = useCallback(() => {
    setLocalBins(null);
    setDisplayArray([]);
    setShowingAllTrees(false);
  }, []);

  return useMemo(() => ({
    localBins,
    displayArray,
    showingAllTrees,
    isReady: workerConfigReady && !!globalBpPerUnit,
    reset
  }), [localBins, displayArray, showingAllTrees, workerConfigReady, globalBpPerUnit, reset]);
}
