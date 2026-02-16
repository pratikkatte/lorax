import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { parseTreeLayoutBuffer, EMPTY_TREE_LAYOUT } from '../utils/arrowUtils.js';

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Quick check if two treeData objects have equivalent content (avoid redundant setState).
 */
function treeDataContentEquivalent(a, b) {
  if (!a || !b) return false;
  if (a.node_id?.length !== b.node_id?.length) return false;
  if (!arraysEqual(a.tree_indices, b.tree_indices)) return false;
  if (a.node_id?.length > 0 && (a.node_id[0] !== b.node_id[0] || a.node_id[a.node_id.length - 1] !== b.node_id[b.node_id.length - 1])) {
    return false;
  }
  return true;
}

function normalizeTargetLocalBBox(targetLocalBBox) {
  if (!targetLocalBBox || typeof targetLocalBBox !== 'object') return null;
  const treeIndex = Number(targetLocalBBox.treeIndex);
  const minX = Number(targetLocalBBox.minX);
  const maxX = Number(targetLocalBBox.maxX);
  const minY = Number(targetLocalBBox.minY);
  const maxY = Number(targetLocalBBox.maxY);
  if (
    !Number.isFinite(treeIndex)
    || !Number.isFinite(minX)
    || !Number.isFinite(maxX)
    || !Number.isFinite(minY)
    || !Number.isFinite(maxY)
  ) {
    return null;
  }
  return {
    treeIndex,
    minX,
    maxX,
    minY,
    maxY
  };
}

function sameTargetLocalBBox(a, b) {
  if (!a || !b) return false;
  const EPSILON = 1e-9;
  return (
    Number(a.treeIndex) === Number(b.treeIndex)
    && Math.abs(Number(a.minX) - Number(b.minX)) <= EPSILON
    && Math.abs(Number(a.maxX) - Number(b.maxX)) <= EPSILON
    && Math.abs(Number(a.minY) - Number(b.minY)) <= EPSILON
    && Math.abs(Number(a.maxY) - Number(b.maxY)) <= EPSILON
  );
}

function createEmptyCachedTree(treeIdx) {
  return {
    node_id: [],
    parent_id: [],
    is_tip: [],
    x: [],
    y: [],
    time: [],
    name: [],
    mut_x: [],
    mut_y: [],
    mut_node_id: [],
    tree_idx: treeIdx
  };
}

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
  const margin = viewWidth * marginFactor; // Keep trees within 50% extra viewport width

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
 * @param {Object|null} params.lockView - Optional lock-view bbox payload
 * @param {Object} params.tsconfig - Tree sequence config (for cache invalidation on file change)
 * @param {number[]} params.genomicCoords - Viewport bounds [startBp, endBp] for cache eviction
 * @returns {Object} { treeData, isLoading, isBackgroundRefresh, fetchReason, error, clearCache }
 */
export function useTreeData({
  displayArray,
  queryTreeLayout,
  isConnected,
  lockView = null,
  tsconfig = null,
  genomicCoords = null,
}) {

  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackgroundRefresh, setIsBackgroundRefresh] = useState(false);
  const [fetchReason, setFetchReason] = useState('cache-only');
  const [error, setError] = useState(null);

  // Request ID counter - only process response if it matches latest request
  const requestIdRef = useRef(0);

  // Cache: Map<tree_idx, {node data for that tree}>
  const treeDataCacheRef = useRef(new Map());

  // Time bounds (file-level constants, cached from first fetch)
  const timeBoundsRef = useRef(null);

  // Cache key for invalidation (file identity + effective detail mode).
  // Backend now infers sparsification from tree count.
  const cacheKeyRef = useRef({ tsconfigId: null, inferredSparsification: null });

  // Previous display array, used to classify lock-view heartbeat refreshes.
  const previousDisplayArrayRef = useRef([]);
  const lastLockRefreshRef = useRef({
    targetTreeIndex: null,
    targetLocalBBox: null
  });

  // Derive stable file identity from tsconfig
  const tsconfigId = tsconfig?.file_path || tsconfig?.genome_length || null;

  const inferredSparsification = (displayArray?.length ?? 0) > 1;

  const normalizedLockView = useMemo(() => {
    if (!lockView || typeof lockView !== 'object') return null;
    const normalizedBBox = normalizeTargetLocalBBox(lockView.targetLocalBBox);
    if (!normalizedBBox) return null;
    const targetIndexRaw = Number(lockView.targetIndex);
    const targetIndex = Number.isFinite(targetIndexRaw)
      ? targetIndexRaw
      : normalizedBBox.treeIndex;
    if (targetIndex !== normalizedBBox.treeIndex) return null;
    return {
      targetIndex,
      targetLocalBBox: normalizedBBox
    };
  }, [lockView]);

  const lockTargetIndex = useMemo(() => {
    if (!Array.isArray(displayArray)) return null;
    if (!normalizedLockView) return null;
    const candidate = Number(normalizedLockView.targetIndex);
    if (!Number.isFinite(candidate)) return null;
    return displayArray.includes(candidate) ? candidate : null;
  }, [normalizedLockView, displayArray]);

  // Invalidate cache when file or inferred detail mode changes
  useEffect(() => {
    if (cacheKeyRef.current.tsconfigId !== tsconfigId ||
        cacheKeyRef.current.inferredSparsification !== inferredSparsification) {
      treeDataCacheRef.current.clear();
      timeBoundsRef.current = null;
      cacheKeyRef.current = { tsconfigId, inferredSparsification };
      previousDisplayArrayRef.current = [];
      lastLockRefreshRef.current = { targetTreeIndex: null, targetLocalBBox: null };
    }
  }, [tsconfigId, inferredSparsification]);

  // Manual cache clear callback
  const clearCache = useCallback(() => {
    treeDataCacheRef.current.clear();
    timeBoundsRef.current = null;
    previousDisplayArrayRef.current = [];
    lastLockRefreshRef.current = { targetTreeIndex: null, targetLocalBBox: null };
  }, []);

  // Fetch immediately when displayArray changes (no debounce)
  useEffect(() => {
    // Skip if not connected or no method available
    if (!isConnected || !queryTreeLayout) return;

    // Empty displayArray = no trees to fetch
    if (!displayArray || displayArray.length === 0) {
      setTreeData(EMPTY_TREE_LAYOUT);
      setIsLoading(false);
      setIsBackgroundRefresh(false);
      setFetchReason('cache-only');
      previousDisplayArrayRef.current = [];
      lastLockRefreshRef.current = { targetTreeIndex: null, targetLocalBBox: null };
      return;
    }

    const cache = treeDataCacheRef.current;

    // Filter to only unfetched tree indices
    const unfetchedIndices = displayArray.filter((idx) => !cache.has(idx));

    const hasCompleteCache = unfetchedIndices.length === 0 && !!timeBoundsRef.current;
    const displayArrayUnchanged = arraysEqual(displayArray, previousDisplayArrayRef.current);
    const displayArrayChanged = !displayArrayUnchanged;
    const hasValidLockTarget = normalizedLockView != null && lockTargetIndex != null;
    const lockTargetChanged = (
      lockTargetIndex != null
      && Number(lastLockRefreshRef.current.targetTreeIndex) !== Number(lockTargetIndex)
    );
    const lockBBoxChanged = lockTargetChanged
      ? true
      : !sameTargetLocalBBox(
        lastLockRefreshRef.current.targetLocalBBox,
        normalizedLockView?.targetLocalBBox
      );

    let requestKind = 'cache-only';

    if (
      unfetchedIndices.length > 0
      || !timeBoundsRef.current
      || displayArrayChanged
    ) {
      requestKind = 'full-fetch';
    } else if (
      hasValidLockTarget
      && hasCompleteCache
      && (lockTargetChanged || lockBBoxChanged)
    ) {
      requestKind = 'lock-refresh';
    }

    if (requestKind === 'cache-only') {
      const cachedData = buildTreeDataFromCache(cache, displayArray);
      const mergedData = { ...cachedData, ...timeBoundsRef.current };
      setTreeData((previousTreeData) => (
        treeDataContentEquivalent(mergedData, previousTreeData)
          ? previousTreeData
          : mergedData
      ));
      setIsLoading(false);
      setIsBackgroundRefresh(false);
      setFetchReason('cache-only');
      previousDisplayArrayRef.current = displayArray.slice();
      return;
    }

    // Increment request ID for this request
    const currentRequestId = ++requestIdRef.current;

    setFetchReason(requestKind);
    setError(null);
    if (requestKind === 'lock-refresh') {
      setIsLoading(false);
      setIsBackgroundRefresh(true);
    } else {
      setIsLoading(true);
      setIsBackgroundRefresh(false);
    }

    (async () => {
      try {
        const indicesToFetch = requestKind === 'lock-refresh'
          ? [lockTargetIndex]
          : (unfetchedIndices.length > 0 ? unfetchedIndices : displayArray);
        const lockViewForRequest = requestKind === 'lock-refresh'
          ? normalizedLockView
          : null;

        if (requestKind === 'full-fetch') {
          lastLockRefreshRef.current = { targetTreeIndex: null, targetLocalBBox: null };
        }

        if (requestKind === 'lock-refresh' && lockTargetIndex != null) {

          lastLockRefreshRef.current = {
            targetTreeIndex: lockTargetIndex,
            targetLocalBBox: lockViewForRequest?.targetLocalBBox ?? null
          };
        }

        const response = await queryTreeLayout(indicesToFetch, {
          actualDisplayArray: displayArray,
          lockView: lockViewForRequest
        });

        // Ignore stale response if a newer request was sent
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Parse PyArrow buffer using utility
        const parsed = parseTreeLayoutBuffer(response.buffer);

        if (requestKind === 'lock-refresh' && lockTargetIndex != null) {
          cache.delete(lockTargetIndex);
        }

        // Update cache with new trees
        updateCacheFromResponse(cache, parsed);
        if (requestKind === 'lock-refresh' && lockTargetIndex != null) {
          const returnedTreeIndices = new Set(
            (parsed?.tree_idx || [])
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value))
          );
          if (!returnedTreeIndices.has(lockTargetIndex)) {
            cache.set(lockTargetIndex, createEmptyCachedTree(lockTargetIndex));
          }
        }

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
        setIsBackgroundRefresh(false);
        setFetchReason(requestKind);
        previousDisplayArrayRef.current = displayArray.slice();
      } catch (err) {
        // Ignore errors from stale requests
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        console.error('[useTreeData] Failed to fetch tree data:', err);
        setError(err);
        setIsLoading(false);
        setIsBackgroundRefresh(false);
      }
    })();
  }, [
    displayArray,
    queryTreeLayout,
    isConnected,
    normalizedLockView,
    lockTargetIndex,
    genomicCoords,
    tsconfig
  ]);

  return useMemo(() => ({
    treeData,
    isLoading,
    isBackgroundRefresh,
    fetchReason,
    error,
    clearCache
  }), [treeData, isLoading, isBackgroundRefresh, fetchReason, error, clearCache]);
}
