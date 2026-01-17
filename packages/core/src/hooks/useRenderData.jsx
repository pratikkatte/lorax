import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import workerSpec from '../workers/renderDataWorker.js?worker&inline';

let requestIdCounter = 0;

/**
 * Hook to compute render data (typed arrays) for tree visualization.
 * Sends tree data + localBins to worker, receives typed arrays for deck.gl layers.
 *
 * @param {Object} params
 * @param {Map|null} params.localBins - Map of tree_idx -> { modelMatrix, ... } from useLocalData
 * @param {Object|null} params.treeData - { node_id[], parent_id[], is_tip[], tree_idx[], x[], y[] } from useTreeData
 * @param {Object} params.metadataArrays - Optional metadata for tip coloring
 * @param {Object} params.metadataColors - Optional color mapping for metadata values
 * @param {Object} params.populationFilter - Optional { colorBy, enabledValues }
 * @param {number} params.debounceMs - Debounce delay (default: 100)
 * @returns {Object} { renderData, isLoading, error, isReady }
 */
export function useRenderData({
  localBins,
  treeData,
  metadataArrays = null,
  metadataColors = null,
  populationFilter = null,
  debounceMs = 100
}) {
  const [renderData, setRenderData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const workerRef = useRef(null);
  const pendingRequestsRef = useRef(new Map());
  const debounceTimer = useRef(null);
  const latestRequestId = useRef(0);

  // Initialize worker once
  useEffect(() => {
    const worker = new workerSpec();
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

    return () => {
      // Cancel pending debounce
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Reject all pending requests
      for (const { reject } of pendingRequestsRef.current.values()) {
        reject(new Error('Worker terminated'));
      }
      pendingRequestsRef.current.clear();

      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

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

  /**
   * Serialize localBins Map for worker transfer
   * Extracts only trees with modelMatrix (visible trees)
   */
  const serializeModelMatrices = useCallback((bins) => {
    if (!bins || !(bins instanceof Map)) return [];

    const result = [];
    for (const [key, value] of bins.entries()) {
      if (value.modelMatrix && value.visible !== false) {
        result.push({
          key,
          modelMatrix: Array.isArray(value.modelMatrix)
            ? value.modelMatrix
            : value.modelMatrix.toArray?.() ?? value.modelMatrix
        });
      }
    }
    return result;
  }, []);

  // Trigger computation when inputs change
  useEffect(() => {
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
        console.log('[useRenderData] Computing render data for', visibleCount, 'trees,', treeData.node_id.length, 'nodes');

        const result = await request('compute-render-data', {
          node_id: treeData.node_id,
          parent_id: treeData.parent_id,
          is_tip: treeData.is_tip,
          tree_idx: treeData.tree_idx,
          x: treeData.x,
          y: treeData.y,
          modelMatrices: serializeModelMatrices(localBins),
          metadataArrays,
          metadataColors,
          populationFilter
        });

        // Ignore stale responses
        if (requestId !== latestRequestId.current) {
          console.log('[useRenderData] Ignoring stale response');
          return;
        }

        console.log('[useRenderData] Received:', result.edgeCount, 'edges,', result.tipCount, 'tips');

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
  }, [localBins, treeData, metadataArrays, metadataColors, populationFilter, debounceMs, request, serializeModelMatrices]);

  /**
   * Clear worker buffers to free memory
   */
  const clearBuffers = useCallback(() => {
    return request('clear-buffers', null);
  }, [request]);

  return useMemo(() => ({
    renderData,
    isLoading,
    error,
    isReady: !!workerRef.current,
    clearBuffers
  }), [renderData, isLoading, error, clearBuffers]);
}
