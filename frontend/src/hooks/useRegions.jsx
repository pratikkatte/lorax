
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
 * useRegions Hook (Edge-based)
 * Manages tree selection and binning, fetches edges from backend,
 * and builds trees locally from edge data.
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
  const { queryEdges, queryLocalBins, getTreeFromEdges } = backend;

  const [localBins, setLocalBins] = useState(null);

  const isFetching = useRef(false);

  const region = useRef(null);
  const cachedEdgesRange = useRef({ start: null, end: null });

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

      // Step 1: Get local bins (determines which trees to show)
      const { local_bins, lower_bound, upper_bound, displayArray, showing_all_trees } = await queryLocalBins(
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

      showingAllTrees.current = showing_all_trees;

      // Step 2: Fetch edges for the viewport if needed
      const needsEdges = displayArray.some(idx => {
        const bin = local_bins.get(idx);
        return !bin?.path;
      });

      if (needsEdges) {
        setStatusMessage({ status: "loading", message: "Fetching tree data..." });

        try {
          // Fetch edges for the viewport range
          const edgesResult = await queryEdges(region.current[0], region.current[1]);

          if (edgesResult?.edges) {
            // Store edges in worker
            await storeEdgesInWorker(edgesResult.edges, edgesResult.start, edgesResult.end);
            cachedEdgesRange.current = { start: edgesResult.start, end: edgesResult.end };
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
      }

      // Step 3: Build trees from edges for each displayed tree
      let hadError = false;
      for (const idx of displayArray) {
        if (local_bins.has(idx)) {
          const bin = local_bins.get(idx);

          // Get tree from edges (will build if not cached)
          const path = await getTreeFromEdges(idx, {
            precision: bin.precision,
            showingAllTrees: showing_all_trees
          });

          if (!path) {
            hadError = true;
            setStatusMessage({
              status: "error",
              message: "Failed to render tree data. Try zooming in or reloading."
            });
            break;
          }

          local_bins.set(idx, {
            ...bin,
            path: path
          });
        }
      }

      setLocalBins(local_bins);
      if (!hadError) {
        setStatusMessage(null);
      }
      isFetching.current = false;
    }, 400, { leading: false, trailing: true }),
    [isFetching.current, valueRef.current, xzoom, selectionStrategy, tsconfig?.node_times]
  );

  // Helper to store edges in worker
  const storeEdgesInWorker = useCallback((edges, start, end) => {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data.type === "store-edges-done") {
          resolve();
        }
      };
      // This will be called via the worker through backend
      backend.workerRef?.current?.postMessage({
        type: "store-edges",
        data: { edges, start, end }
      });
      // For simplicity, resolve immediately - the worker will have the data
      setTimeout(resolve, 50);
    });
  }, [backend.workerRef]);

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
  }), [localBins, localCoordinates, times]);
};

export default useRegions;
