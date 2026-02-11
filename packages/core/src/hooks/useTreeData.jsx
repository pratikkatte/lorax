import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { parseTreeLayoutBuffer, EMPTY_TREE_LAYOUT } from '../utils/arrowUtils.js';

/**
 * Update cache with trees from parsed response.
 * Groups nodes and mutations by tree_idx and stores in cache.
 */
function updateCacheFromResponse(cache, parsed) {
  const { node_id, parent_id, is_tip, tree_idx, x, y, time, name, mut_x, mut_y, mut_tree_idx, mut_node_id } = parsed;

  // Group node data by tree_idx
  const treeIndices = [...new Set(tree_idx)];
  for (const idx of treeIndices) {
    // Create mask for nodes belonging to this tree
    const nodeData = {
      node_id: [],
      parent_id: [],
      is_tip: [],
      x: [],
      y: [],
      time: [],
      name: []
    };

    for (let i = 0; i < tree_idx.length; i++) {
      if (tree_idx[i] === idx) {
        nodeData.node_id.push(node_id[i]);
        nodeData.parent_id.push(parent_id[i]);
        nodeData.is_tip.push(is_tip[i]);
        nodeData.x.push(x[i]);
        nodeData.y.push(y[i]);
        nodeData.time.push(time[i]);
        nodeData.name.push(name?.[i] ?? '');
      }
    }

    // Get mutations for this tree
    const mutData = { mut_x: [], mut_y: [], mut_node_id: [] };
    const hasMutNodeId = Array.isArray(mut_node_id) && mut_node_id.length === mut_tree_idx.length;
    for (let i = 0; i < mut_tree_idx.length; i++) {
      if (mut_tree_idx[i] === idx) {
        mutData.mut_x.push(mut_x[i]);
        mutData.mut_y.push(mut_y[i]);
        mutData.mut_node_id.push(hasMutNodeId ? mut_node_id[i] : null);
      }
    }

    cache.set(idx, { ...nodeData, ...mutData, tree_idx: idx });
  }
}

/**
 * Evict cached trees whose genomic bounds are completely outside viewport.
 * Uses margin buffer to prevent thrashing during rapid panning.
 *
 * @param {Map} cache - Tree data cache (Map<tree_idx, data>)
 * @param {number[]} intervals - Array of genomic positions (one per tree index)
 * @param {number[]} genomicCoords - Current viewport bounds [startBp, endBp]
 * @param {number} marginFactor - Extra viewport width to keep (default 0.5 = 50%)
 * @returns {number} Count of evicted trees
 */
function evictOutOfViewTrees(cache, intervals, genomicCoords, marginFactor = 0.5) {
  if (!intervals || !genomicCoords || intervals.length === 0) return 0;

  const [viewStart, viewEnd] = genomicCoords;
  const viewWidth = viewEnd - viewStart;
  const margin = viewWidth * marginFactor;  // Keep trees within 50% extra viewport width

  const evictStart = viewStart - margin;
  const evictEnd = viewEnd + margin;

  let evictedCount = 0;

  // Check each cached tree
  for (const treeIdx of cache.keys()) {
    // Tree spans from intervals[treeIdx] to intervals[treeIdx + 1]
    const treeStart = intervals[treeIdx];
    const treeEnd = intervals[treeIdx + 1] ?? intervals[treeIdx];

    // Evict if tree is completely outside viewport + margin
    if (treeEnd < evictStart || treeStart > evictEnd) {
      cache.delete(treeIdx);
      evictedCount++;
    }
  }

  return evictedCount;
}

/**
 * Build combined treeData from cache for given displayArray.
 * Concatenates cached data for all requested tree indices.
 */
function buildTreeDataFromCache(cache, displayArray) {
  const result = {
    node_id: [],
    parent_id: [],
    is_tip: [],
    tree_idx: [],
    x: [],
    y: [],
    time: [],
    name: [],
    mut_x: [],
    mut_y: [],
    mut_tree_idx: [],
    mut_node_id: [],
    tree_indices: []
  };

  for (const idx of displayArray) {
    const cached = cache.get(idx);
    if (cached) {
      result.node_id.push(...cached.node_id);
      result.parent_id.push(...cached.parent_id);
      result.is_tip.push(...cached.is_tip);
      result.x.push(...cached.x);
      result.y.push(...cached.y);
      result.time.push(...cached.time);
      result.name.push(...(cached.name || []));
      // Fill tree_idx array with the index for each node
      for (let i = 0; i < cached.node_id.length; i++) {
        result.tree_idx.push(idx);
      }
      // Mutations
      result.mut_x.push(...cached.mut_x);
      result.mut_y.push(...cached.mut_y);
      result.mut_node_id.push(...(cached.mut_node_id || []));
      for (let i = 0; i < cached.mut_x.length; i++) {
        result.mut_tree_idx.push(idx);
      }
      result.tree_indices.push(idx);
    }
  }

  return result;
}

/**
 * Hook to fetch tree layout data from backend when displayArray changes.
 * Implements frontend caching to avoid re-fetching already loaded trees.
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
 * @param {boolean} params.sparsification - Enable sparsification (default false)
 * @param {Object} params.tsconfig - Tree sequence config (for cache invalidation on file change)
 * @param {number[]} params.genomicCoords - Viewport bounds [startBp, endBp] for cache eviction
 * @returns {Object} { treeData, isLoading, error, clearCache }
 */
export function useTreeData({
  displayArray,
  queryTreeLayout,
  isConnected,
  sparsification = false,
  tsconfig = null,
  genomicCoords = null,
}) {

  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Request ID counter - only process response if it matches latest request
  const requestIdRef = useRef(0);

  // Cache: Map<tree_idx, {node data for that tree}>
  const treeDataCacheRef = useRef(new Map());

  // Time bounds (file-level constants, cached from first fetch)
  const timeBoundsRef = useRef(null);

  // Cache key for invalidation (file identity + sparsification)
  const cacheKeyRef = useRef({ tsconfigId: null, sparsification: null });

  // Derive stable file identity from tsconfig
  const tsconfigId = tsconfig?.file_path || tsconfig?.genome_length || null;

  // Invalidate cache when file or sparsification changes
  useEffect(() => {
    if (cacheKeyRef.current.tsconfigId !== tsconfigId ||
        cacheKeyRef.current.sparsification !== sparsification) {
      treeDataCacheRef.current.clear();
      timeBoundsRef.current = null;
      cacheKeyRef.current = { tsconfigId, sparsification };
    }
  }, [tsconfigId, sparsification]);

  // Manual cache clear callback
  const clearCache = useCallback(() => {
    treeDataCacheRef.current.clear();
    timeBoundsRef.current = null;
  }, []);

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

    const cache = treeDataCacheRef.current;

    // Filter to only unfetched tree indices
    const unfetchedIndices = displayArray.filter(idx => !cache.has(idx));

    // If all trees are cached and we have time bounds, build from cache only
    if (unfetchedIndices.length === 0 && timeBoundsRef.current) {
      const cachedData = buildTreeDataFromCache(cache, displayArray);
      setTreeData({
        ...cachedData,
        ...timeBoundsRef.current
      });
      setIsLoading(false);
      return;
    }

    // Increment request ID for this request
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        // Only fetch unfetched trees (or all if no time bounds yet)
        const indicesToFetch = unfetchedIndices.length > 0 ? unfetchedIndices : displayArray;
        const response = await queryTreeLayout(indicesToFetch, sparsification, displayArray);

        // Ignore stale response if a newer request was sent
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Parse PyArrow buffer using utility
        const parsed = parseTreeLayoutBuffer(response.buffer);

        // Update cache with new trees
        updateCacheFromResponse(cache, parsed);

        // Evict trees outside visible genomic window (with margin)
        if (genomicCoords && tsconfig?.intervals) {
          evictOutOfViewTrees(cache, tsconfig.intervals, genomicCoords);
        }

        // Cache time bounds on first fetch (they're file-level constants)
        if (!timeBoundsRef.current) {
          timeBoundsRef.current = {
            global_min_time: response.global_min_time,
            global_max_time: response.global_max_time
          };
        }

        // Build combined treeData from cache for full displayArray
        const mergedData = buildTreeDataFromCache(cache, displayArray);
        setTreeData({
          ...mergedData,
          ...timeBoundsRef.current
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
    error,
    clearCache
  }), [treeData, isLoading, error, clearCache]);
}
