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
 * Process raw edge data from backend.
 * Backend now returns raw edges (left, right, parent, child) + node_times.
 * EdgeCompositeLayer computes the layout using edgeTreeBuilder.
 */
function processRawEdgeData(backendData) {
  if (!backendData || backendData.error) return null;

  const { left, right, parent, child, node_times } = backendData;

  // Return raw data for EdgeCompositeLayer to process
  return {
    left: Array.from(left),
    right: Array.from(right),
    parent: Array.from(parent),
    child: Array.from(child),
    node_times
  };
}

/**
 * useRegions Hook (Edge-based)
 * Manages tree selection and binning, fetches raw edges from backend.
 * EdgeCompositeLayer computes layout from raw edges using edgeTreeBuilder.
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


      // Step 3: Fetch raw edge data from backend
      // Backend now returns raw edges (left, right, parent, child) + node_times
      // EdgeCompositeLayer computes layout using edgeTreeBuilder
      let layoutData_backend = null;
      try {
        if (displayArray.length > 0) {
          // Fetch raw edges for all displayed trees
          const backendResult = await queryLayout(displayArray);

          if (backendResult && !backendResult.error) {
            // Process raw edge data - no per-tree splitting needed
            layoutData_backend = processRawEdgeData(backendResult);
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
    [isFetching.current, valueRef.current, xzoom, selectionStrategy, tsconfig?.intervals, queryLocalBins, queryEdges, globalBpPerUnit, getTreeFromEdges]
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
