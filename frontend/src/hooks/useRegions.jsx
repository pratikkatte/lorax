import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import debounce from "lodash.debounce";
import memoizeOne from "memoize-one";

// Utility functions
function niceStep(step) {
  const exp = Math.floor(Math.log10(step));
  const base = Math.pow(10, exp);
  const multiples = [1, 2, 5, 10];
  for (let m of multiples) if (step <= m * base) return m * base;
  return multiples[multiples.length - 1] * base;
}

const getLocalCoordinates = memoizeOne((lo, hi) => {
  const range = hi - lo;
  const divisions = range > 1000 ? 5 : 10;
  const rawStep = range / divisions;
  const stepSize = niceStep(rawStep);
  const start = Math.ceil(lo / stepSize) * stepSize;
  const end = Math.floor(hi / stepSize) * stepSize;
  const n = Math.floor((end - start) / stepSize) + 1;
  return Array.from({ length: n }, (_, i) => {
    const x = start + i * stepSize;
    return x;
  });
});

function getDynamicBpPerUnit(globalBpPerUnit, zoom, baseZoom = 8) {
  const zoomDiff = zoom - baseZoom;
  const scaleFactor = Math.pow(2, -zoomDiff);
  return globalBpPerUnit * scaleFactor;
}

// Maximum cached tree layouts to prevent memory bloat
const MAX_CACHED_LAYOUTS = 100;

/**
 * Parse pre-computed layout from backend into per-tree format.
 * Backend returns flat arrays; we split them by tree for efficient access.
 */
function parseLayoutData(backendData, displayArray) {
  if (!backendData || backendData.error) return null;

  const {
    edge_coords = [],
    tip_coords = [],
    tree_intervals = [],
    tree_edge_counts = [],
    tree_tip_counts = []
  } = backendData;

  const layoutMap = new Map();
  let edgeOffset = 0;
  let tipOffset = 0;

  for (let i = 0; i < displayArray.length; i++) {
    const treeIdx = displayArray[i];
    const edgeCount = tree_edge_counts[i] || 0;
    const tipCount = tree_tip_counts[i] || 0;
    const interval = tree_intervals[i] || [0, 0];

    // Extract edge coordinates for this tree (6 floats per edge: y1,x1, y2,x2, y3,x3)
    const edgeSliceEnd = edgeOffset + edgeCount * 6;
    const edges = new Float32Array(edge_coords.slice(edgeOffset, edgeSliceEnd));
    edgeOffset = edgeSliceEnd;

    // Extract tip coordinates for this tree (3 floats per tip: y, x, node_id)
    const tipSliceEnd = tipOffset + tipCount * 3;
    const tips = new Float32Array(tip_coords.slice(tipOffset, tipSliceEnd));
    tipOffset = tipSliceEnd;

    layoutMap.set(treeIdx, {
      edges,
      tips,
      edgeCount,
      tipCount,
      interval
    });
  }

  return layoutMap;
}

/**
 * Evict old layouts from cache when it exceeds max size.
 * Keeps layouts closest to current viewport.
 */
function evictOldLayouts(cache, currentViewport, maxSize) {
  if (cache.size <= maxSize) return cache;

  const [vpStart, vpEnd] = currentViewport;
  const vpCenter = (vpStart + vpEnd) / 2;

  // Sort by distance from viewport center
  const entries = [...cache.entries()];
  entries.sort((a, b) => {
    const distA = Math.abs(a[1].interval[0] - vpCenter);
    const distB = Math.abs(b[1].interval[0] - vpCenter);
    return distB - distA; // Furthest first
  });

  // Remove furthest until under limit
  const newCache = new Map();
  const keepCount = maxSize;
  for (let i = entries.length - keepCount; i < entries.length; i++) {
    if (i >= 0) {
      newCache.set(entries[i][0], entries[i][1]);
    }
  }

  return newCache;
}

/**
 * useRegions Hook (Edge-based with Layout Caching)
 * Manages tree selection and binning, fetches pre-computed layouts from backend,
 * and caches them for efficient re-use during panning.
 */
const useRegions = ({
  backend,
  valueRef,
  globalBpPerUnit,
  tsconfig,
  setStatusMessage,
  xzoom,
  yzoom,
  genomicValues,
  displayOptions = {}
}) => {
  const { queryEdges, queryLocalBins, getTreeFromEdges, queryLayout } = backend;

  const [localBins, setLocalBins] = useState(null);

  const isFetching = useRef(false);

  const region = useRef(null);
  const [edgesData, setEdgesData] = useState(null);
  const [layoutData, setLayoutData] = useState(null);

  // Layout cache: tree_index -> { edges, tips, edgeCount, tipCount, interval }
  const layoutCacheRef = useRef(new Map());

  const [times, setTimes] = useState([]);
  const showingAllTrees = useRef(false);

  // Extract display options with defaults
  const {
    selectionStrategy = 'largestSpan'
  } = displayOptions;

  const debouncedQuery = useMemo(
    () => debounce(async (val) => {
      if (isFetching.current) return;
      if (!tsconfig?.node_times) {
        console.warn("[useRegions] tsconfig.node_times not available yet");
        return;
      }

      const [lo, hi] = val;
      const zoom = xzoom ?? 8;

      const new_globalBp = getDynamicBpPerUnit(globalBpPerUnit, zoom);


      if (showingAllTrees.current) {
        if (region.current && (region.current[0] > lo || region.current[1] < hi)) {
          region.current = [Math.min(region.current[0], lo), Math.max(region.current[1], hi)];
        } else if (!region.current) {
          region.current = [lo, hi];
        }
      } else {
        region.current = [lo, hi];
      }

      if (!region.current) {
        region.current = [lo, hi];
      }

      isFetching.current = true;

      // Step 1: Fetch edges for the viewport range and cache in worker
      setStatusMessage({ status: "loading", message: "Fetching tree data..." });

      let edgesResult;
      try {
        // edgesResult = await queryEdges(region.current[0], region.current[1]);
        if (edgesResult?.edges) {
          // setEdgesData(edgesResult.edges);
        }
      } catch (err) {
        console.error("[useRegions] Error fetching edges:", err);
        setStatusMessage({
          status: "error",
          message: "Failed to fetch tree data. Try reloading or selecting a smaller region."
        });
        isFetching.current = false;
        return;
      }

      // Step 2: Compute local bins and select visible trees in the worker
      let binsResult;
      try {
        binsResult = await queryLocalBins(
          region.current[0],
          region.current[1],
          globalBpPerUnit,
          null,
          new_globalBp,
          null,
          {
            selectionStrategy
          }
        );
      } catch (err) {
        console.error("[useRegions] Error computing local bins:", err);
        setStatusMessage({
          status: "error",
          message: "Failed to compute visible trees. Try reloading or selecting a smaller region."
        });
        isFetching.current = false;
        return;
      }

      const {
        local_bins = new Map(),
        displayArray = [],
        showing_all_trees = false
      } = binsResult || {};

      showingAllTrees.current = showing_all_trees;


      // Step 3: Fetch layout from backend only for uncached trees
      let layoutData_backend = null;
      try {
        if (displayArray.length > 0) {
          // Check which trees are already cached
          const uncachedTrees = displayArray.filter(
            idx => !layoutCacheRef.current.has(idx)
          );

          if (uncachedTrees.length > 0) {
            // Fetch only uncached trees from backend
            const backendResult = await queryLayout(uncachedTrees);

            if (backendResult && !backendResult.error) {
              // Parse and add to cache
              const newLayouts = parseLayoutData(backendResult, uncachedTrees);
              if (newLayouts) {
                for (const [treeIdx, layout] of newLayouts) {
                  layoutCacheRef.current.set(treeIdx, layout);
                }
              }
            }
          }

          // Evict old layouts if cache is too large
          if (layoutCacheRef.current.size > MAX_CACHED_LAYOUTS) {
            layoutCacheRef.current = evictOldLayouts(
              layoutCacheRef.current,
              [lo, hi],
              MAX_CACHED_LAYOUTS
            );
          }

          // Assemble layout data for all visible trees from cache
          layoutData_backend = new Map();
          for (const treeIdx of displayArray) {
            const cached = layoutCacheRef.current.get(treeIdx);
            if (cached) {
              layoutData_backend.set(treeIdx, cached);
            }
          }
        }
      } catch (err) {
        console.error("[useRegions] Error fetching layout:", err);
        setStatusMessage({
          status: "error",
          message: "Failed to render tree layout."
        });
      }

      setLocalBins(local_bins);
      setLayoutData(layoutData_backend);

      if (!layoutData_backend?.error) {
        setStatusMessage(null);
      }
      isFetching.current = false;
    }, 400, { leading: false, trailing: true }),
    [isFetching.current, valueRef.current, xzoom, selectionStrategy, tsconfig?.node_times, queryLocalBins, queryEdges, globalBpPerUnit, getTreeFromEdges]
  );

  useEffect(() => {
    if (valueRef.current && tsconfig?.node_times) {
      debouncedQuery(valueRef.current);
    }
  }, [valueRef.current, xzoom, tsconfig?.node_times]);

  useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);

  const localCoordinates = useMemo(() => {
    if (!valueRef.current) return [];
    const [lo, hi] = valueRef.current;
    const bufferFrac = 0.1;
    const range = hi - lo;
    return getLocalCoordinates(lo - bufferFrac * range, hi + bufferFrac * range);
  }, [valueRef.current]);

  useEffect(() => {
    if (tsconfig && tsconfig?.times?.values) {

      setTimes((prev) => {
        let newTime = [];
        let maxTime, minTime;
        maxTime = tsconfig?.times.values[1].toFixed(0);
        minTime = tsconfig?.times.values[0].toFixed(0);

        const range = maxTime - minTime;

        // Calculate step size based on xzoom value
        // Finer steps for higher zoom (smaller intervals)
        let step;

        if (yzoom >= 18) step = 1;
        else if (yzoom >= 16) step = range / 1000;
        else if (yzoom >= 14) step = range / 500;
        else if (yzoom >= 12) step = range / 100;
        else if (yzoom >= 10) step = range / 50;
        else if (yzoom >= 8) step = range / 10;
        else if (yzoom >= 5) step = range / 5;
        else step = 1000;

        for (let i = Number(maxTime); i >= Number(minTime); i -= step) {
          // For decimal steps, ensure correct floating point logic
          let roundedI = Math.abs(step) < 1 ? Number(i.toFixed(3)) : Math.round(i);
          let position = (maxTime - roundedI) / (maxTime - minTime);
          newTime.push({ position, text: roundedI });
        }
        return newTime;
      });
    }

  }, [tsconfig, yzoom]);

  return useMemo(() => ({
    bins: localBins,
    localCoordinates,
    times,
    edgesData,
    layoutData
  }), [localBins, localCoordinates, times, edgesData, layoutData]);
};

export default useRegions;
