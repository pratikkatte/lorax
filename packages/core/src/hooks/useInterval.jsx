import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Hook to manage interval state for visualization.
 * Uses worker passed from context for interval queries.
 * Config sending is handled by useLoraxConfig.
 *
 * @param {Object} params
 * @param {Object} params.worker - Worker instance from useLoraxConfig
 * @param {boolean} params.workerConfigReady - Whether worker has received config
 * @param {[number, number]} params.genomicCoords - Current viewport [startBp, endBp]
 * @returns {Object} { visibleIntervals, isReady, refresh }
 */
export function useInterval({ worker, workerConfigReady, genomicCoords }) {
  const [visibleIntervals, setVisibleIntervals] = useState([]);
  const latestRequestIdRef = useRef(0);

  // Query intervals when viewport changes (config sending handled by useLoraxConfig)
  useEffect(() => {
    if (!workerConfigReady || !genomicCoords || !worker) return;

    const [start, end] = genomicCoords;
    const requestId = ++latestRequestIdRef.current;

    worker.queryIntervals(start, end)
      .then((result) => {
        // Only update if this is still the latest request
        if (requestId === latestRequestIdRef.current) {
          setVisibleIntervals(result?.visibleIntervals || []);
        }
      })
      .catch((error) => {
        // Only log if this is still the latest request
        if (requestId === latestRequestIdRef.current) {
          console.error('Failed to query intervals:', error);
        }
      });
  }, [workerConfigReady, genomicCoords, worker]);

  // Manual refresh method
  const refresh = useCallback(() => {
    if (!workerConfigReady || !genomicCoords || !worker) return;

    const [start, end] = genomicCoords;
    const requestId = ++latestRequestIdRef.current;

    worker.queryIntervals(start, end)
      .then((result) => {
        if (requestId === latestRequestIdRef.current) {
          setVisibleIntervals(result?.visibleIntervals || []);
        }
      })
      .catch((error) => {
        if (requestId === latestRequestIdRef.current) {
          console.error('Failed to refresh intervals:', error);
        }
      });
  }, [workerConfigReady, genomicCoords, worker]);

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    visibleIntervals,
    isReady: workerConfigReady,
    refresh
  }), [visibleIntervals, workerConfigReady, refresh]);
}
