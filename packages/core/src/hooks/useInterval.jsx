import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const DEBUG_INTERVAL_PERF = Boolean(globalThis?.__LORAX_PERF_DEBUG__);
const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

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
 * @param {number} params.previewMaxIntervals - Max intervals during interaction preview (default: 400)
 * @param {boolean} params.isInteracting - Whether viewport is actively being manipulated
 * @returns {Object} { visibleIntervals, intervalBounds, intervalCount, isReady, reset }
 *   - visibleIntervals: Decimated intervals for display (max maxIntervals)
 *   - intervalBounds: { lo, hi } global index bounds for useLocalData (worker keeps full array)
 *   - intervalCount: Pre-decimation interval count
 */
export function useInterval({
  worker,
  workerConfigReady,
  genomicCoords,
  debounceMs = 16,
  maxIntervals = 2000,
  previewMaxIntervals = 400,
  isInteracting = false
}) {
  const [visibleIntervals, setVisibleIntervals] = useState([]);
  const [intervalBounds, setIntervalBounds] = useState({ lo: 0, hi: 0 }); // Global index bounds
  const [intervalCount, setIntervalCount] = useState(0); // Pre-decimation count
  const [intervalsCoords, setIntervalsCoords] = useState(null); // Genomic coords used to fetch intervals

  // For request cancellation
  const latestRequestIdRef = useRef(0);
  const debounceTimerRef = useRef(null);

  const effectiveMaxIntervals = useMemo(() => {
    if (!isInteracting) return maxIntervals;
    const preview = Number.isFinite(previewMaxIntervals) ? previewMaxIntervals : 400;
    const steady = Number.isFinite(maxIntervals) ? maxIntervals : 2000;
    return Math.max(1, Math.min(preview, steady));
  }, [isInteracting, previewMaxIntervals, maxIntervals]);

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
      const startedAt = now();

      try {
        // Worker returns decimated visibleIntervals + lo/hi bounds.
        // Full interval array stays in worker — useLocalData references via lo/hi.
        const result = await worker.request('intervals', {
          start: newLo,
          end: newHi,
          maxIntervals: effectiveMaxIntervals
        });

        // Check if this request is still current
        if (requestId !== latestRequestIdRef.current) return;

        const lo = result?.lo ?? 0;
        const hi = result?.hi ?? 0;

        // Store global index bounds for useLocalData
        setIntervalBounds({ lo, hi });

        // Store pre-decimation count (for treesInWindowCount)
        setIntervalCount(result?.count ?? 0);

        // Store genomic coords used for these intervals
        setIntervalsCoords(genomicCoords);

        // visibleIntervals already decimated by worker
        setVisibleIntervals(result?.visibleIntervals || []);

        if (DEBUG_INTERVAL_PERF) {
          const elapsedMs = Number((now() - startedAt).toFixed(2));
          console.debug('[lorax-perf] intervals', {
            elapsedMs,
            count: result?.count ?? 0,
            visibleCount: result?.visibleIntervals?.length ?? 0,
            lo,
            hi,
            maxIntervals: effectiveMaxIntervals,
            isInteracting
          });
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
  }, [workerConfigReady, genomicCoords, worker, debounceMs, effectiveMaxIntervals, isInteracting]);

  // Reset method - call when underlying data changes
  const reset = useCallback(() => {
    setVisibleIntervals([]);
    setIntervalBounds({ lo: 0, hi: 0 });
    setIntervalCount(0);
  }, []);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    visibleIntervals,      // Decimated intervals for display (max maxIntervals)
    intervalBounds,        // { lo, hi } - global index bounds for useLocalData
    intervalCount,         // Pre-decimation count for treesInWindowCount
    intervalsCoords,       // Genomic coords for interval request
    isReady: workerConfigReady,
    reset
  }), [visibleIntervals, intervalBounds, intervalCount, intervalsCoords, workerConfigReady, reset]);
}
