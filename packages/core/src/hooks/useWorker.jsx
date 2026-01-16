import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import workerSpec from '../workers/localBackendWorker.js?worker&inline';

let requestIdCounter = 0;

/**
 * Hook providing Promise-based communication with the web worker.
 * Pure communication layer - no state management for intervals.
 *
 * @returns {Object} Worker API with Promise-based methods
 */
export function useWorker() {
  const workerRef = useRef(null);
  const pendingRequestsRef = useRef(new Map());
  const [isReady, setIsReady] = useState(false);

  // Initialize worker once
  useEffect(() => {
    const worker = new workerSpec();
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, id, data } = event.data;

      // Resolve pending promise if this is a response with an id
      if (id !== undefined && pendingRequestsRef.current.has(id)) {
        const { resolve } = pendingRequestsRef.current.get(id);
        pendingRequestsRef.current.delete(id);
        resolve(data);
      }
    };

    setIsReady(true);

    return () => {
      // Reject all pending requests on cleanup
      for (const { reject } of pendingRequestsRef.current.values()) {
        reject(new Error('Worker terminated'));
      }
      pendingRequestsRef.current.clear();
      worker?.terminate();
      workerRef.current = null;
      setIsReady(false);
    };
  }, []);

  /**
   * Send a request to the worker and return a Promise for the response
   * @param {string} type - Message type
   * @param {any} data - Message data
   * @param {number} timeout - Timeout in ms (default: 30000)
   * @returns {Promise<any>}
   */
  const request = useCallback((type, data, timeout = 30000) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = ++requestIdCounter;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (pendingRequestsRef.current.has(id)) {
          pendingRequestsRef.current.delete(id);
          reject(new Error(`Worker request timed out: ${type}`));
        }
      }, timeout);

      // Store promise handlers with timeout cleanup
      pendingRequestsRef.current.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // Send message to worker
      workerRef.current.postMessage({ type, id, data });
    });
  }, []);

  /**
   * Send configuration to the worker
   * @param {Object} tsconfig - Tree sequence configuration
   * @returns {Promise<void>}
   */
  const sendConfig = useCallback((tsconfig) => {
    return request('config', tsconfig);
  }, [request]);

  /**
   * Query intervals for a given viewport range
   * @param {number} start - Start position (bp)
   * @param {number} end - End position (bp)
   * @returns {Promise<{visibleIntervals: number[]}>}
   */
  const queryIntervals = useCallback((start, end) => {
    return request('intervals', { start, end });
  }, [request]);

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    isReady,
    request,
    sendConfig,
    queryIntervals
  }), [isReady, request, sendConfig, queryIntervals]);
}
