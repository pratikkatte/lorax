import { useState, useEffect, useRef, useMemo } from 'react';
import { parseTreeLayoutBuffer, EMPTY_TREE_LAYOUT } from '../utils/arrowUtils.js';

/**
 * Hook to fetch tree layout data from backend when displayArray changes.
 *
 * @param {Object} params
 * @param {number[]} params.displayArray - Tree indices to fetch (from useLocalData)
 * @param {Function} params.queryTreeLayout - Socket method from useLorax
 * @param {boolean} params.isConnected - Socket connection status
 * @param {Object} params.sparsityOptions - Optional { resolution, precision }
 * @param {number} params.debounceMs - Debounce delay (default: 150)
 * @returns {Object} { treeData, isLoading, error }
 */
export function useTreeData({
  displayArray,
  queryTreeLayout,
  isConnected,
  sparsityOptions = {},
  debounceMs = 150
}) {
  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimer = useRef(null);
  const latestRequestId = useRef(0);

  // Serialize sparsityOptions to avoid object reference issues in dependency array
  const sparsityOptionsKey = JSON.stringify(sparsityOptions);

  useEffect(() => {
    // Skip if not connected or no method available
    if (!isConnected || !queryTreeLayout) return;

    // Empty displayArray = no trees to fetch
    if (!displayArray || displayArray.length === 0) {
      setTreeData(EMPTY_TREE_LAYOUT);
      setIsLoading(false);
      return;
    }

    // Clear pending request
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setIsLoading(true);
    setError(null);

    debounceTimer.current = setTimeout(async () => {
      const requestId = ++latestRequestId.current;

      try {
        const response = await queryTreeLayout(displayArray, sparsityOptions);

        // Ignore stale responses
        if (requestId !== latestRequestId.current) {
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
        if (requestId !== latestRequestId.current) return;

        console.error('[useTreeData] Failed to fetch tree data:', err);
        setError(err);
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [displayArray, queryTreeLayout, isConnected, sparsityOptionsKey, debounceMs]);

  return useMemo(() => ({
    treeData,
    isLoading,
    error
  }), [treeData, isLoading, error]);
}
