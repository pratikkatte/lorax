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
 * @returns {Object} { visibleIntervals, isReady, reset }
 */
export function useInterval({
  worker,
  workerConfigReady,
  genomicCoords,
  debounceMs = 16,
  maxIntervals = 2000
}) {
  const [visibleIntervals, setVisibleIntervals] = useState([]);

  // Accumulated intervals from all fetches
  const allIntervalsRef = useRef(new Set());

  // Previous viewport bounds [lo, hi]
  const prevBoundsRef = useRef(null);

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
      const prev = prevBoundsRef.current;
      const requestId = ++latestRequestIdRef.current;

      // Determine which regions need fetching
      const regionsToFetch = [];

      if (!prev) {
        // Initial load - fetch entire range
        regionsToFetch.push([newLo, newHi]);
      } else {
        const [prevLo, prevHi] = prev;

        // Check if completely disjoint (big jump) - reset and fetch all
        if (newHi < prevLo || newLo > prevHi) {
          allIntervalsRef.current.clear();
          regionsToFetch.push([newLo, newHi]);
        } else {
          // Left expansion: new viewport extends left of previous
          if (newLo < prevLo) {
            regionsToFetch.push([newLo, prevLo]);
          }
          // Right expansion: new viewport extends right of previous
          if (newHi > prevHi) {
            regionsToFetch.push([prevHi, newHi]);
          }
          // Zoom in case: no new regions needed, just filter existing
        }
      }

      // Fetch new regions and merge into accumulated set
      for (const [start, end] of regionsToFetch) {
        try {
          const result = await worker.queryIntervals(start, end);

          // Check if this request is still current
          if (requestId !== latestRequestIdRef.current) return;

          // Add new intervals to the accumulated set
          for (const interval of (result?.visibleIntervals || [])) {
            allIntervalsRef.current.add(interval);
          }
        } catch (error) {
          if (requestId === latestRequestIdRef.current) {
            console.error('Failed to query intervals:', error);
          }
          return;
        }
      }

      // Update previous bounds
      prevBoundsRef.current = [newLo, newHi];

      // Memory cleanup: trim intervals far outside current view
      // Keep 2x viewport width to handle small pans without refetch
      const range = newHi - newLo;
      const trimThreshold = range * 2;
      const trimmedSet = new Set();
      for (const pos of allIntervalsRef.current) {
        if (pos >= newLo - trimThreshold && pos <= newHi + trimThreshold) {
          trimmedSet.add(pos);
        }
      }
      allIntervalsRef.current = trimmedSet;

      // Filter to current viewport and sort
      const inView = [...allIntervalsRef.current]
        .filter(pos => pos >= newLo && pos <= newHi)
        .sort((a, b) => a - b);

      // Apply LOD decimation if too many intervals
      if (inView.length > maxIntervals) {
        const step = Math.ceil(inView.length / maxIntervals);
        const decimated = [];
        for (let i = 0; i < inView.length; i += step) {
          decimated.push(inView[i]);
        }
        setVisibleIntervals(decimated);
      } else {
        setVisibleIntervals(inView);
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
    allIntervalsRef.current.clear();
    prevBoundsRef.current = null;
    setVisibleIntervals([]);
  }, []);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    visibleIntervals,
    isReady: workerConfigReady,
    reset
  }), [visibleIntervals, workerConfigReady, reset]);
}
