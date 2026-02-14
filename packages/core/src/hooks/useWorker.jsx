import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

let requestIdCounter = 0;

/**
 * Generic hook providing Promise-based communication with a web worker.
 * Pure communication layer - no state management for intervals.
 *
 * NOTE: This hook relies on the workerSpecs loader and expects worker support
 * in the current build/runtime.
 *
 * @param {Function} getWorkerModule - Async function that returns a Worker class
 * @returns {Object} Worker API with { isReady, request }
 */
export function useWorker(getWorkerModule) {
  const workerRef = useRef(null);
  const pendingRequestsRef = useRef(new Map());
  const [isReady, setIsReady] = useState(false);

  // Initialize worker once
  useEffect(() => {
    if (!getWorkerModule) {
      console.warn('[useWorker] No worker module provided');
      return;
    }

    let mounted = true;

    async function initWorker() {
      const WorkerClass = await getWorkerModule();

      if (!mounted) return;

      if (!WorkerClass) {
        console.warn('[useWorker] Worker not available');
        return;
      }

      const worker = new WorkerClass();
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const { type, id, data, success, error: errorMsg } = event.data;

        // Resolve pending promise if this is a response with an id
        if (id !== undefined && pendingRequestsRef.current.has(id)) {
          const { resolve, reject } = pendingRequestsRef.current.get(id);
          pendingRequestsRef.current.delete(id);

          // Support both response formats:
          // 1. { id, data } - simple format from localBackendWorker
          // 2. { id, success, data, error } - explicit format from renderDataWorker
          if (success === false) {
            reject(new Error(errorMsg || 'Worker error'));
          } else {
            resolve(data);
          }
        }
      };

      worker.onerror = (err) => {
        console.error('[useWorker] Worker error:', err);
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
  }, [getWorkerModule]);

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

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    isReady,
    request
  }), [isReady, request]);
}
