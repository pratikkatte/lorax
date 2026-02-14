import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { serializeModelMatrices } from '../utils/renderUtils.js';
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
 * @returns {Object} { renderData, isLoading, error, isReady, clearBuffers }
 */
export function useRenderData({
  localBins,
  treeData,
  displayArray = null,
  metadataArrays = null,
  metadataColors = null,
  populationFilter = null
}) {
  const [renderData, setRenderData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const latestRequestId = useRef(0);

  // Use generic worker hook
  const worker = useWorker(getRenderDataWorker);

  useEffect(() => {
    if (!worker.isReady) return;

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
          displayArray: displayArray ?? EMPTY_DISPLAY_ARRAY,
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
  }, [worker, localBins, treeData, displayArray, metadataArrays, metadataColors, populationFilter]);

  const clearBuffers = useCallback(() => {
    if (!worker.isReady) {
      return Promise.resolve();
    }
    return worker.request('clear-buffers', null);
  }, [worker]);

  return useMemo(() => ({
    renderData,
    isLoading,
    error,
    isReady: worker.isReady,
    clearBuffers
  }), [renderData, isLoading, error, worker.isReady, clearBuffers]);
}
