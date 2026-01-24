import { useState, useEffect, useMemo, useRef } from 'react';
import { parseTreeLayoutBuffer, EMPTY_TREE_LAYOUT } from '../utils/arrowUtils.js';

/**
 * Hook to fetch tree layout data from backend when displayArray changes.
 *
 * NOTE: This hook executes immediately without debounce.
 * Debouncing should be applied at the viewport/genomicCoords level (useInterval)
 * to ensure atomic processing and prevent race conditions.
 *
 * Uses request ID pattern to ignore stale responses - only the latest
 * request's response is processed, preventing race conditions.
 *
 * @param {Object} params
 * @param {number[]} params.displayArray - Tree indices to fetch (from useLocalData)
 * @param {Function} params.queryTreeLayout - Socket method from useLorax
 * @param {boolean} params.isConnected - Socket connection status
 * @param {boolean} params.sparsification - Enable tip-only sparsification (default false)
 * @returns {Object} { treeData, isLoading, error }
 */
export function useTreeData({
  displayArray,
  queryTreeLayout,
  isConnected,
  sparsification = false
}) {
  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Request ID counter - only process response if it matches latest request
  const requestIdRef = useRef(0);

  // Fetch immediately when displayArray changes (no debounce)
  useEffect(() => {
    // Skip if not connected or no method available
    if (!isConnected || !queryTreeLayout) return;

    // Empty displayArray = no trees to fetch
    if (!displayArray || displayArray.length === 0) {
      setTreeData(EMPTY_TREE_LAYOUT);
      setIsLoading(false);
      return;
    }

    // Increment request ID for this request
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await queryTreeLayout(displayArray, sparsification);

        // Ignore stale response if a newer request was sent
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Parse PyArrow buffer using utility
        const parsed = parseTreeLayoutBuffer(response.buffer);
        setTreeData({
          ...parsed,
          global_min_time: response.global_min_time,
          global_max_time: response.global_max_time,
          tree_indices: response.tree_indices || []
        });
        setIsLoading(false);
      } catch (err) {
        // Ignore errors from stale requests
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        console.error('[useTreeData] Failed to fetch tree data:', err);
        setError(err);
        setIsLoading(false);
      }
    })();
  }, [displayArray, queryTreeLayout, isConnected, sparsification]);

  return useMemo(() => ({
    treeData,
    isLoading,
    error
  }), [treeData, isLoading, error]);
}
