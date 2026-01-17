import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Hook to manage interval state for visualization with incremental fetching.
 *
 * Instead of fetching all intervals on every viewport change, this hook:
 * 1. Tracks previous viewport bounds
 * 2. Only fetches intervals for newly visible regions (deltas)
 * 3. Accumulates intervals in a Set to avoid duplicates
 * 4. Applies LOD decimation when too many intervals are visible
 *
 * @param {Object} params
 * @param {Object} params.worker - Worker instance from useLoraxConfig
 * @param {boolean} params.workerConfigReady - Whether worker has received config
 * @param {[number, number]} params.genomicCoords - Current viewport [startBp, endBp]
 * @param {number} params.debounceMs - Debounce delay in ms (default: 16)
 * @param {number} params.maxIntervals - Max intervals to render (LOD threshold, default: 2000)
 * @returns {Object} { visibleIntervals, allIntervalsInView, isReady, reset }
 *   - visibleIntervals: Decimated intervals for display (max maxIntervals)
 *   - allIntervalsInView: Pre-decimation intervals for useLocalData
 */
export function useInterval({
  worker,
  workerConfigReady,
  genomicCoords,
  debounceMs = 16,
  maxIntervals = 2000
}) {
  const [visibleIntervals, setVisibleIntervals] = useState([]);
  const [allIntervalsInView, setAllIntervalsInView] = useState([]); // Pre-decimation intervals for useLocalData
  const [intervalBounds, setIntervalBounds] = useState({ lo: 0, hi: 0 }); // Global index bounds

  // For request cancellation
  const latestRequestIdRef = useRef(0);
  const debounceTimerRef = useRef(null);

  // Main effect: incremental fetching with debounce
  useEffect(() => {
    if (!workerConfigReady || !genomicCoords || !worker) return;

    // Clear pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const [newLo, newHi] = genomicCoords;
      const requestId = ++latestRequestIdRef.current;

      try {
        // Query full viewport to get intervals AND global index bounds (lo, hi)
        const result = await worker.queryIntervals(newLo, newHi);

        // Check if this request is still current
        if (requestId !== latestRequestIdRef.current) return;

        const intervals = result?.visibleIntervals || [];
        const lo = result?.lo ?? 0;
        const hi = result?.hi ?? 0;

        // Store global index bounds for useLocalData
        setIntervalBounds({ lo, hi });

        // Store pre-decimation intervals for useLocalData
        setAllIntervalsInView(intervals);

        // Apply LOD decimation if too many intervals (for display only)
        if (intervals.length > maxIntervals) {
          const step = Math.ceil(intervals.length / maxIntervals);
          const decimated = [];
          for (let i = 0; i < intervals.length; i += step) {
            decimated.push(intervals[i]);
          }
          setVisibleIntervals(decimated);
        } else {
          setVisibleIntervals(intervals);
        }
      } catch (error) {
        if (requestId === latestRequestIdRef.current) {
          console.error('Failed to query intervals:', error);
        }
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [workerConfigReady, genomicCoords, worker, debounceMs, maxIntervals]);

  // Reset method - call when underlying data changes
  const reset = useCallback(() => {
    setVisibleIntervals([]);
    setAllIntervalsInView([]);
    setIntervalBounds({ lo: 0, hi: 0 });
  }, []);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    visibleIntervals,      // Decimated intervals for display (max 2000)
    allIntervalsInView,    // Pre-decimation intervals for useLocalData
    intervalBounds,        // { lo, hi } - global index bounds for useLocalData
    isReady: workerConfigReady,
    reset
  }), [visibleIntervals, allIntervalsInView, intervalBounds, workerConfigReady, reset]);
}
