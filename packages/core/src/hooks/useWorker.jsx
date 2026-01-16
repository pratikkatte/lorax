import { useState, useEffect, useRef, useCallback } from 'react';
import workerSpec from '../workers/localBackendWorker.js?worker&inline';

/**
 * Hook to manage web worker communication for interval visualization
 * - Creates worker instance
 * - Sends config when tsconfig changes
 * - Queries intervals when viewport changes
 * - Returns visibleIntervals for layer rendering
 *
 * @param {Object} params
 * @param {Object} params.tsconfig - Tree sequence configuration (contains intervals array)
 * @param {[number, number]} params.genomicCoords - Current viewport [startBp, endBp]
 * @returns {Object} { visibleIntervals, isReady }
 */
export function useWorker({ tsconfig, genomicCoords }) {
  const workerRef = useRef(null);
  const [visibleIntervals, setVisibleIntervals] = useState([]);
  const [isReady, setIsReady] = useState(false);

  // Initialize worker once
  useEffect(() => {
    const worker = new workerSpec();
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, data } = event.data;

      if (type === 'config') {
        setIsReady(true);
      }

      if (type === 'intervals') {
        setVisibleIntervals(data?.visibleIntervals || []);
      }
    };

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Send config to worker when tsconfig changes
  useEffect(() => {
    if (!tsconfig || !workerRef.current) return;

    workerRef.current.postMessage({
      type: 'config',
      data: tsconfig
    });
  }, [tsconfig]);

  // Query intervals when viewport changes
  useEffect(() => {
    if (!isReady || !genomicCoords || !workerRef.current) return;

    const [start, end] = genomicCoords;
    workerRef.current.postMessage({
      type: 'intervals',
      data: { start, end }
    });
  }, [isReady, genomicCoords]);

  return { visibleIntervals, isReady };
}
