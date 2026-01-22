import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

let requestIdCounter = 0;

// Lazy worker loader - only executed in Vite environments
// The dynamic import with the ?worker&inline query string is Vite-specific
// Webpack will fail to resolve this, but we catch the error
let workerModulePromise = null;

function getWorkerModule() {
  if (workerModulePromise === null) {
    // Use a function-based dynamic import to prevent webpack from
    // statically analyzing and failing on the Vite-specific syntax
    workerModulePromise = (async () => {
      try {
        // This import syntax only works in Vite
        // In webpack, this will fail and we'll return null
        // The magic comments tell both bundlers to skip static analysis
        const module = await import(/* webpackIgnore: true */ /* @vite-ignore */ '../workers/localBackendWorker.js?worker&inline');
        return module.default;
      } catch (e) {
        console.warn('[useWorker] Worker import failed (expected in non-Vite environments):', e.message);
        return null;
      }
    })();
  }
  return workerModulePromise;
}

/**
 * Hook providing Promise-based communication with the web worker.
 * Pure communication layer - no state management for intervals.
 *
 * NOTE: This hook only works in Vite environments. For webpack/non-Vite builds,
 * use useLocalData with mode='main-thread' instead.
 *
 * @returns {Object} Worker API with Promise-based methods
 */
export function useWorker() {
  const workerRef = useRef(null);
  const pendingRequestsRef = useRef(new Map());
  const [isReady, setIsReady] = useState(false);

  // Initialize worker once
  useEffect(() => {
    let mounted = true;

    async function initWorker() {
      const WorkerClass = await getWorkerModule();

      if (!mounted) return;

      if (!WorkerClass) {
        console.warn('[useWorker] Worker not available - use main-thread mode instead');
        return;
      }

      const worker = new WorkerClass();
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
    }

    initWorker();

    return () => {
      mounted = false;
      // Reject all pending requests on cleanup
      for (const { reject } of pendingRequestsRef.current.values()) {
        reject(new Error('Worker terminated'));
      }
      pendingRequestsRef.current.clear();
      workerRef.current?.terminate();
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

  /**
   * Query local data (tree positioning and visibility) for given intervals
   * @param {Object} params
   * @param {number[]} params.intervals - Pre-decimation interval positions
   * @param {number} params.start - Viewport start (bp)
   * @param {number} params.end - Viewport end (bp)
   * @param {number} params.globalBpPerUnit - Base pairs per unit
   * @param {number} params.new_globalBp - Zoom-adjusted bp per unit
   * @param {number} params.genome_length - Total genome length
   * @param {Object} params.displayOptions - { selectionStrategy }
   * @returns {Promise<{local_bins: Array, displayArray: number[], showing_all_trees: boolean}>}
   */
  const queryLocalData = useCallback((params) => {
    return request('local-data', params);
  }, [request]);

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    isReady,
    request,
    sendConfig,
    queryIntervals,
    queryLocalData
  }), [isReady, request, sendConfig, queryIntervals, queryLocalData]);
}
