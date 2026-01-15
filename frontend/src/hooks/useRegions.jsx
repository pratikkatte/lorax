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

/**
 * Calculate sparsity resolution based on zoom state and display context.
 * Lower resolution = more aggressive sparsification (fewer nodes).
 * Returns null for no sparsification (full detail).
 *
 * @param {number} numTrees - Number of trees being displayed
 * @param {boolean} showingAllTrees - Whether all trees fit in viewport
 * @param {number} scaleFactor - Zoom scale factor (>1 = zoomed out)
 */
function getSparsityResolution(numTrees, showingAllTrees, scaleFactor) {
  // No sparsification when viewing few trees (detailed view)
  if (numTrees <= 2) return null;

  // Scale resolution inversely with zoom-out level
  // scaleFactor > 1 means multiple trees per slot (zoomed out)
  if (scaleFactor > 5) return 50;   // Very zoomed out
  if (scaleFactor > 2) return 100;   // Moderately zoomed out
  if (showingAllTrees) return 200;  // All trees visible but not heavily zoomed

  return null;  // Full detail
}

/**
 * Calculate sparsity precision based on zoom state and display context.
 * Uses decimal rounding: precision=2 means nodes must differ by ≥0.01 to both appear.
 * Lower precision = more aggressive sparsification (fewer nodes).
 * Returns null for no sparsification (full detail).
 *
 * @param {number} numTrees - Number of trees being displayed
 * @param {boolean} showingAllTrees - Whether all trees fit in viewport
 * @param {number} scaleFactor - Zoom scale factor (>1 = zoomed out)
 */
function getSparsityPrecision(numTrees, showingAllTrees, scaleFactor) {
  // No sparsification when viewing few trees (detailed view)
  if (numTrees <= 2) return null;

  // Scale precision inversely with zoom-out level
  // Lower precision = more aggressive (fewer decimal places = larger buckets)
  if (scaleFactor > 5) return 2;   // Very zoomed out: 10% granularity
  if (scaleFactor > 2) return 3;   // Moderately zoomed: 1% granularity
  if (showingAllTrees) return 4;   // Light: 0.1% granularity

  return null;  // Full detail
}

/**
 * Process post-order data from backend.
 * Backend returns post-order traversal arrays with parent pointers and pre-computed x,y coordinates.
 * PostOrderCompositeLayer uses backend coordinates directly (no recomputation).
 *
 * Optimized schema (v2):
 * - Removed 'time' field (derivable from x coordinate and global_min/max_time)
 * - tree_idx is int32 (supports large tree sequences)
 *
 * MEMORY OPTIMIZATION: No longer uses Array.from() which doubled memory.
 * Typed arrays from Arrow are passed through directly.
 */
function processPostorderData(backendData) {
  if (!backendData || backendData.error) return null;

  const { node_id, parent_id, is_tip, tree_idx, x, y, global_min_time, global_max_time, tree_indices } = backendData;

  // Pass through typed arrays directly - NO Array.from() to avoid doubling memory
  // PostOrderCompositeLayer works with both typed arrays and regular arrays
  return {
    node_id: node_id || [],
    parent_id: parent_id || [],
    is_tip: is_tip || [],
    tree_idx: tree_idx || [],
    x: x || [],
    y: y || [],
    global_min_time,
    global_max_time,
    tree_indices
  };
}

/**
 * useRegions Hook (Post-order based)
 * Manages tree selection and binning, fetches post-order traversal from backend.
 * PostOrderCompositeLayer computes layout using stack-based reconstruction.
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
  displayOptions = {},
  // Props for worker-based rendering
  metadataArrays,
  metadataColors,
  populationFilter
}) => {
  const { queryLocalBins, getTreeFromEdges, queryPostorderLayout, queryPostorderLayoutWithRender } = backend;

  const [localBins, setLocalBins] = useState(null);

  const isFetching = useRef(false);

  const region = useRef(null);
  const [edgesData, setEdgesData] = useState(null);
  const [postorderData, setPostorderData] = useState(null);
  const [renderData, setRenderData] = useState(null);  // Pre-computed typed arrays from worker

  const [times, setTimes] = useState([]);
  const showingAllTrees = useRef(false);

  // Extract display options with defaults
  const {
    selectionStrategy = 'largestSpan'
  } = displayOptions;

  const debouncedQuery = useMemo(
    () => debounce(async (val) => {
      if (isFetching.current) return;
      if (!tsconfig?.intervals) {
        console.warn("[useRegions] tsconfig.intervals not available yet");
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

      // rewriting here. 
      region.current = [lo, hi];

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
        displayArray = [],           // Trees to fetch from backend (uncached)
        allDisplayIndices = [],      // All trees to render (cached + uncached)
        showing_all_trees = false
      } = binsResult || {};

      showingAllTrees.current = showing_all_trees;


      // Step 3: Fetch post-order data and compute render arrays in worker
      // Worker handles PyArrow parsing + typed array computation off main thread
      let postorderData_backend = null;
      let workerRenderData = null;
      try {
        // Proceed if there are any trees to render (cached or uncached)
        if (allDisplayIndices.length > 0) {
          // Calculate sparsity based on zoom state
          // scaleFactor > 1 means zoomed out (multiple trees per slot)
          const scaleFactor = new_globalBp / globalBpPerUnit;

          // Use precision-based sparsification (takes precedence)
          // const sparsityPrecision = getSparsityPrecision(
          //   allDisplayIndices.length,
          //   showing_all_trees,
          //   scaleFactor
          // );

          const sparsityPrecision = 2;
          // Grid-based sparsification
          const sparsityResolution = null;

          console.log('[Sparsification]', {
            scaleFactor: scaleFactor.toFixed(2),
            numTrees: allDisplayIndices.length,
            fetchingFromBackend: displayArray.length,
            showingAllTrees: showing_all_trees,
            method: sparsityPrecision !== null ? 'precision' : (sparsityResolution !== null ? 'grid' : 'none'),
            sparsityPrecision: sparsityPrecision ?? 'none',
            sparsityResolution: sparsityResolution ?? 'none'
          });

          // Use worker-based render computation if available (fast path)
          if (queryPostorderLayoutWithRender) {
            const workerResult = await queryPostorderLayoutWithRender(
              displayArray,          // Trees to fetch from backend (may be empty if all cached)
              local_bins,            // bins with modelMatrix
              metadataArrays,
              metadataColors,
              populationFilter,
              sparsityResolution,
              sparsityPrecision,
              allDisplayIndices      // All trees to render (cached + uncached)
            );

            console.log("[useRegions] Worker result:", workerResult ? `paths: ${workerResult.pathPositions?.length}, tips: ${workerResult.tipPositions?.length}` : 'null');
            if (workerResult && !workerResult.error) {
              workerRenderData = workerResult;
              // Keep postorderData for backwards compatibility (metadata)
              postorderData_backend = {
                global_min_time: workerResult.global_min_time,
                global_max_time: workerResult.global_max_time,
                tree_indices: workerResult.tree_indices
              };
            }
          } else {
            // Fallback: use old queryPostorderLayout (legacy path)
            const backendResult = await queryPostorderLayout(displayArray, sparsityResolution, sparsityPrecision);
            if (backendResult && !backendResult.error) {
              postorderData_backend = processPostorderData(backendResult);
            }
          }
        }
      } catch (err) {
        console.error("[useRegions] Error fetching postorder layout:", err);
        setStatusMessage({
          status: "error",
          message: "Failed to render tree layout."
        });
      }

      setLocalBins(local_bins);
      setPostorderData(postorderData_backend);
      console.log("[useRegions] Setting renderData:", workerRenderData ? `paths: ${workerRenderData.pathPositions?.length}` : 'null');
      setRenderData(workerRenderData);

      if (!postorderData_backend?.error) {
        setStatusMessage(null);
      }
      isFetching.current = false;
    }, 400, { leading: false, trailing: true }),
    [isFetching.current, valueRef.current, xzoom, selectionStrategy, tsconfig?.intervals, queryLocalBins, globalBpPerUnit, getTreeFromEdges, queryPostorderLayout, queryPostorderLayoutWithRender, metadataArrays, metadataColors, populationFilter]
  );

  useEffect(() => {
    if (valueRef.current && tsconfig?.intervals) {
      debouncedQuery(valueRef.current);
    }
  }, [valueRef.current, xzoom, tsconfig?.intervals]);

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

      setTimes(() => {
        const maxTime = Number(tsconfig.times.values[1]);
        const minTime = Number(tsconfig.times.values[0]);
        const totalRange = maxTime - minTime;

        if (totalRange <= 0) return [];

        // Target ~8-12 ticks regardless of zoom level
        // This prevents clutter at any zoom
        const targetTicks = 10;

        // Calculate raw step and snap to nice number
        const rawStep = totalRange / targetTicks;
        const step = niceStep(rawStep);

        // Generate ticks at nice intervals
        const newTime = [];
        const start = Math.ceil(minTime / step) * step;
        const end = Math.floor(maxTime / step) * step;

        for (let value = start; value <= end; value += step) {
          // Avoid floating point errors
          const roundedValue = Math.round(value * 1e10) / 1e10;
          const position = (maxTime - roundedValue) / totalRange;

          // Format the label based on magnitude
          let text;
          if (step >= 1) {
            text = Math.round(roundedValue);
          } else {
            // Determine decimal places needed
            const decimals = Math.max(0, -Math.floor(Math.log10(step)));
            text = roundedValue.toFixed(decimals);
          }

          newTime.push({ position, text });
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
    postorderData,
    renderData  // Pre-computed typed arrays from worker (fast path)
  }), [localBins, localCoordinates, times, edgesData, postorderData, renderData]);
};

export default useRegions;
