import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { computeRenderArrays, serializeModelMatrices, buildModelMatricesMap } from '../utils/renderUtils.js';
import { supportsWebWorkers } from '../utils/computations.js';
import { useWorker } from './useWorker.jsx';
import { getRenderDataWorker } from '../workers/workerSpecs.js';

const EMPTY_DISPLAY_ARRAY = [];

/**
 * Check if we should skip render computation (missing data or no visible trees).
 * @returns {{ skip: boolean, visibleCount?: number }}
 */
function shouldSkipRender(localBins, treeData) {
  if (!localBins || !treeData || !treeData.node_id || treeData.node_id.length === 0) {
    return { skip: true };
  }
  let visibleCount = 0;
  for (const [, value] of localBins.entries()) {
    if (value.modelMatrix && value.visible !== false) visibleCount++;
  }
  if (visibleCount === 0) {
    return { skip: true };
  }
  return { skip: false, visibleCount };
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
 * NOTE: This hook executes immediately without debounce.
 * Debouncing should be applied at the viewport/genomicCoords level (useInterval)
 * to ensure atomic processing and prevent race conditions.
 *
 * @param {Object} params
 * @param {Map|null} params.localBins - Map of tree_idx -> { modelMatrix, ... } from useLocalData
 * @param {Object|null} params.treeData - { node_id[], parent_id[], is_tip[], tree_idx[], x(layout)[], y(time)[] } from useTreeData
 * @param {Array|null} params.displayArray - Global tree indices that were requested from backend
 * @param {Object} params.metadataArrays - Optional metadata for tip coloring
 * @param {Object} params.metadataColors - Optional color mapping for metadata values
 * @param {Object} params.populationFilter - Optional { colorBy, enabledValues }
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
  mode = 'auto'
}) {
  const [renderData, setRenderData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const latestRequestId = useRef(0);

  // Use generic worker hook
  const worker = useWorker(getRenderDataWorker);

  // Determine effective mode
  const effectiveMode = useMemo(() => {
    if (mode === 'worker') return 'worker';
    if (mode === 'main-thread') return 'main-thread';
    // Auto mode: use worker if we can
    return supportsWebWorkers() ? 'worker' : 'main-thread';
  }, [mode]);

  // Worker mode effect - executes immediately (no debounce)
  useEffect(() => {
    if (effectiveMode !== 'worker' || !worker.isReady) return;

    const { skip } = shouldSkipRender(localBins, treeData);
    if (skip) {
      setRenderData(null);
      return;
    }

    const requestId = ++latestRequestId.current;

    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await worker.request('compute-render-data', {
          node_id: treeData.node_id,
          parent_id: treeData.parent_id,
          is_tip: treeData.is_tip,
          tree_idx: treeData.tree_idx,
          x: treeData.x,
          y: treeData.y,
          name: treeData.name,
          // Mutation fields
          mut_x: treeData.mut_x,
          mut_y: treeData.mut_y,
          mut_tree_idx: treeData.mut_tree_idx,
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
    })();
  }, [effectiveMode, worker, localBins, treeData, displayArray, metadataArrays, metadataColors, populationFilter]);

  // Main-thread mode effect - executes immediately (no debounce)
  useEffect(() => {
    if (effectiveMode !== 'main-thread') return;

    const { skip } = shouldSkipRender(localBins, treeData);
    if (skip) {
      setRenderData(null);
      return;
    }

    const requestId = ++latestRequestId.current;

    setIsLoading(true);
    setError(null);

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
        name: treeData.name,
        // Mutation fields
        mut_x: treeData.mut_x,
        mut_y: treeData.mut_y,
        mut_tree_idx: treeData.mut_tree_idx,
        modelMatrices: modelMatricesMap,
        displayArray: displayArray ?? EMPTY_DISPLAY_ARRAY,
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
  }, [effectiveMode, localBins, treeData, displayArray, metadataArrays, metadataColors, populationFilter]);

  /**
   * Clear worker buffers to free memory (only in worker mode)
   */
  const clearBuffers = useCallback(() => {
    if (effectiveMode === 'worker' && worker.isReady) {
      return worker.request('clear-buffers', null);
    }
    return Promise.resolve();
  }, [effectiveMode, worker]);

  return useMemo(() => ({
    renderData,
    isLoading,
    error,
    isReady: effectiveMode === 'main-thread' || worker.isReady,
    effectiveMode,
    clearBuffers
  }), [renderData, isLoading, error, effectiveMode, worker.isReady, clearBuffers]);
}
