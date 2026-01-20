import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { computeRenderArrays, serializeModelMatrices, buildModelMatricesMap } from '../utils/renderUtils.js';
import { supportsWebWorkers } from '../utils/computations.js';

let requestIdCounter = 0;

// Lazy worker initialization - only loads if needed
// The dynamic import with the ?worker&inline query string is Vite-specific
// Webpack will fail to resolve this, but we catch the error
let workerModulePromise = null;

function getWorkerSpec() {
  if (workerModulePromise === null) {
    // Use async function to properly catch import errors
    workerModulePromise = (async () => {
      try {
        // This import syntax only works in Vite
        // In webpack, this will fail and we'll return null
        // The magic comments tell both bundlers to skip static analysis
        const module = await import(/* webpackIgnore: true */ /* @vite-ignore */ '../workers/renderDataWorker.js?worker&inline');
        return module.default;
      } catch (e) {
        console.warn('[useRenderData] Worker import failed (expected in non-Vite environments):', e.message);
        return null;
      }
    })();
  }
  return workerModulePromise;
}

/**
 * Hook to compute render data (typed arrays) for tree visualization.
 * Sends tree data + localBins to worker, receives typed arrays for deck.gl layers.
 *
 * Supports two execution modes:
 * - 'worker': Uses web worker for computation (Vite)
 * - 'main-thread': Uses synchronous computation (webpack/non-Vite)
 * - 'auto': Detects environment and chooses appropriate mode
 *
 * @param {Object} params
 * @param {Map|null} params.localBins - Map of tree_idx -> { modelMatrix, ... } from useLocalData
 * @param {Object|null} params.treeData - { node_id[], parent_id[], is_tip[], tree_idx[], x[], y[] } from useTreeData
 * @param {Array|null} params.displayArray - Global tree indices that were requested from backend
 * @param {Object} params.metadataArrays - Optional metadata for tip coloring
 * @param {Object} params.metadataColors - Optional color mapping for metadata values
 * @param {Object} params.populationFilter - Optional { colorBy, enabledValues }
 * @param {number} params.debounceMs - Debounce delay (default: 100)
 * @param {string} params.mode - Execution mode: 'worker' | 'main-thread' | 'auto' (default: 'auto')
 * @returns {Object} { renderData, isLoading, error, isReady, effectiveMode, clearBuffers }
 */
export function useRenderData({
  localBins,
  treeData,
  displayArray = null,
  metadataArrays = null,
  metadataColors = null,
  populationFilter = null,
  debounceMs = 100,
  mode = 'auto'
}) {
  const [renderData, setRenderData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workerReady, setWorkerReady] = useState(false);

  const workerRef = useRef(null);
  const pendingRequestsRef = useRef(new Map());
  const debounceTimer = useRef(null);
  const latestRequestId = useRef(0);

  // Determine effective mode
  const effectiveMode = useMemo(() => {
    if (mode === 'worker') return 'worker';
    if (mode === 'main-thread') return 'main-thread';
    // Auto mode: use worker if we can
    return supportsWebWorkers() ? 'worker' : 'main-thread';
  }, [mode]);

  // Initialize worker only if needed (worker mode)
  useEffect(() => {
    if (effectiveMode !== 'worker') {
      setWorkerReady(true); // Main-thread mode is always ready
      return;
    }

    let mounted = true;

    async function initWorker() {
      try {
        const WorkerClass = await getWorkerSpec();
        if (!mounted || !WorkerClass) {
          // Fallback to main-thread if worker not available
          setWorkerReady(true);
          return;
        }

        const worker = new WorkerClass();
        workerRef.current = worker;

        worker.onmessage = (event) => {
          const { type, id, success, data, error: errorMsg } = event.data;

          if (id !== undefined && pendingRequestsRef.current.has(id)) {
            const { resolve, reject } = pendingRequestsRef.current.get(id);
            pendingRequestsRef.current.delete(id);

            if (success) {
              resolve(data);
            } else {
              reject(new Error(errorMsg || 'Worker error'));
            }
          }
        };

        worker.onerror = (err) => {
          console.error('[useRenderData] Worker error:', err);
          setError(new Error(err.message || 'Worker error'));
        };

        setWorkerReady(true);
      } catch (err) {
        console.warn('[useRenderData] Failed to initialize worker, falling back to main-thread:', err);
        setWorkerReady(true);
      }
    }

    initWorker();

    return () => {
      mounted = false;
      // Cancel pending debounce
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Reject all pending requests
      for (const { reject } of pendingRequestsRef.current.values()) {
        reject(new Error('Worker terminated'));
      }
      pendingRequestsRef.current.clear();

      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [effectiveMode]);

  /**
   * Send a request to the worker and return a Promise
   */
  const request = useCallback((type, data, timeout = 30000) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = ++requestIdCounter;

      const timeoutId = setTimeout(() => {
        if (pendingRequestsRef.current.has(id)) {
          pendingRequestsRef.current.delete(id);
          reject(new Error(`Worker request timed out: ${type}`));
        }
      }, timeout);

      pendingRequestsRef.current.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          reject(err);
        }
      });

      workerRef.current.postMessage({ type, id, data });
    });
  }, []);

  // Worker mode effect
  useEffect(() => {
    if (effectiveMode !== 'worker' || !workerRef.current) return;

    // Skip if missing required data
    if (!localBins || !treeData || !treeData.node_id || treeData.node_id.length === 0) {
      setRenderData(null);
      return;
    }

    // Count visible trees
    let visibleCount = 0;
    for (const [, value] of localBins.entries()) {
      if (value.modelMatrix && value.visible !== false) visibleCount++;
    }

    if (visibleCount === 0) {
      setRenderData(null);
      return;
    }

    // Clear pending debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setIsLoading(true);
    setError(null);

    debounceTimer.current = setTimeout(async () => {
      const requestId = ++latestRequestId.current;

      try {
        const result = await request('compute-render-data', {
          node_id: treeData.node_id,
          parent_id: treeData.parent_id,
          is_tip: treeData.is_tip,
          tree_idx: treeData.tree_idx,
          x: treeData.x,
          y: treeData.y,
          modelMatrices: serializeModelMatrices(localBins),
          displayArray: displayArray || [],
          metadataArrays,
          metadataColors,
          populationFilter
        });

        // Ignore stale responses
        if (requestId !== latestRequestId.current) {
          return;
        }

        setRenderData(result);
        setIsLoading(false);
      } catch (err) {
        if (requestId !== latestRequestId.current) return;

        console.error('[useRenderData] Failed to compute render data:', err);
        setError(err);
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [effectiveMode, localBins, treeData, displayArray, metadataArrays, metadataColors, populationFilter, debounceMs, request]);

  // Main-thread mode effect
  useEffect(() => {
    if (effectiveMode !== 'main-thread') return;

    // Skip if missing required data
    if (!localBins || !treeData || !treeData.node_id || treeData.node_id.length === 0) {
      setRenderData(null);
      return;
    }

    // Count visible trees
    let visibleCount = 0;
    for (const [, value] of localBins.entries()) {
      if (value.modelMatrix && value.visible !== false) visibleCount++;
    }

    if (visibleCount === 0) {
      setRenderData(null);
      return;
    }

    // Clear pending debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setIsLoading(true);
    setError(null);

    debounceTimer.current = setTimeout(() => {
      const requestId = ++latestRequestId.current;

      try {
        // Synchronous computation on main thread
        const modelMatricesMap = buildModelMatricesMap(localBins);
        const result = computeRenderArrays({
          node_id: treeData.node_id,
          parent_id: treeData.parent_id,
          is_tip: treeData.is_tip,
          tree_idx: treeData.tree_idx,
          x: treeData.x,
          y: treeData.y,
          modelMatrices: modelMatricesMap,
          displayArray: displayArray || [],
          metadataArrays,
          metadataColors,
          populationFilter
        });

        // Ignore stale results
        if (requestId !== latestRequestId.current) {
          return;
        }

        setRenderData(result);
        setIsLoading(false);
      } catch (err) {
        if (requestId !== latestRequestId.current) return;

        console.error('[useRenderData] Failed to compute render data:', err);
        setError(err);
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [effectiveMode, localBins, treeData, displayArray, metadataArrays, metadataColors, populationFilter, debounceMs]);

  /**
   * Clear worker buffers to free memory (only in worker mode)
   */
  const clearBuffers = useCallback(() => {
    if (effectiveMode === 'worker' && workerRef.current) {
      return request('clear-buffers', null);
    }
    return Promise.resolve();
  }, [effectiveMode, request]);

  return useMemo(() => ({
    renderData,
    isLoading,
    error,
    isReady: workerReady,
    effectiveMode,
    clearBuffers
  }), [renderData, isLoading, error, workerReady, effectiveMode, clearBuffers]);
}
