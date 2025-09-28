import { useMemo, useEffect, useState, useRef } from "react";
import debounce from "lodash.debounce";
import memoizeOne from "memoize-one";

// ---------- helpers ----------
function getSubset(sampleTrees, prevSampleTrees) {
  if (!sampleTrees || !prevSampleTrees) return null;
  const prevSet = new Set(prevSampleTrees.map(t => t.global_index));
  return sampleTrees.every(t => prevSet.has(t.global_index)) ? sampleTrees : null;
}

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
  const end   = Math.floor(hi / stepSize) * stepSize;
  const n = Math.floor((end - start) / stepSize) + 1;

  return Array.from({ length: n }, (_, i) => {
    const x = start + i * stepSize;
    return { x, y: 0, text: x };
  });
});

function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}
function nearestIndex(arr, x) {
  if (arr.length === 0) return -1;
  if (x <= arr[0]) return 0;
  if (x >= arr[arr.length - 1]) return arr.length - 1;
  const i = lowerBound(arr, x);
  const prev = i - 1;
  return (x - arr[prev] <= arr[i] - x) ? prev : i;
}
function getXArray(globalBins) {
  return globalBins.map(b => b.acc);
}

function sampleTrees(globalBins, lo, hi, nTrees, globalBpPerUnit) {
  const sampled_trees = [];
  const lowest_step = Math.floor(lo / globalBpPerUnit);
  const highest_step = Math.ceil(hi / globalBpPerUnit);

  // const step = Math.max(globalBpPerUnit, Math.floor( Math.pow(2, 17) / Math.pow(2, zoom)));

  for (let i = lowest_step; i < highest_step; i++) {
    const genomic_val = i * globalBpPerUnit;
    const tree_index = nearestIndex(globalBins, genomic_val);
    if (tree_index !== sampled_trees[sampled_trees.length - 1]?.global_index) {
      sampled_trees.push({ index: i, global_index: tree_index, position: genomic_val });
    }
  }
  return sampled_trees;
}
function new_sampleTrees(globalBins, lo, hi, globalBpPerUnit) {
  const sampled_trees = {};
  const lowest_step = Math.floor(lo / globalBpPerUnit);
  const highest_step = Math.ceil(hi / globalBpPerUnit);

  for (let i = lowest_step; i <= highest_step; i++) {
    const genomic_val = i * globalBpPerUnit;
    const tree_index = nearestIndex(globalBins, genomic_val);
    if (tree_index !== sampled_trees[sampled_trees.length - 1]?.global_index) {
      sampled_trees[tree_index] = { index: i, global_index: tree_index, position: genomic_val };
      // sampled_trees.push({ index: i, global_index: tree_index, position: genomic_val });
    }
  }
  return sampled_trees;
}

function upperBound(keys, x) {
  let lo = 0, hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function makeGetLocalData() {
  let lastStart = null;
  let lastEnd = null;
  let localBins = {};

  return async function getLocalData(
    start,
    end,
    globalBins,
    config_intervals,
    queryNodes,
    globalBpPerUnit
  ) {
    const buffer = 0.1;
    const bufferStart = Math.max(0, start - start * buffer);
    const bufferEnd = Math.min(globalBins.length - 1, end + end * buffer);

    const intervalKeys = Object.keys(config_intervals.new_intervals);
    const sampledTrees = new_sampleTrees(
      intervalKeys,
      bufferStart,
      bufferEnd,
      globalBpPerUnit
    );

    const lower_bound = lowerBound(intervalKeys, bufferStart);
    const upper_bound = upperBound(intervalKeys, bufferEnd);

    console.log("lower_bound", lower_bound, "upper_bound", upper_bound)
    // collect all new bins to query in one pass
    const rangeArray = [];

    const addBins = (lo, hi) => {
      for (let i = lo; i <= hi; i++) {
        const temp_bin = globalBins[i];
        const visible = !!sampledTrees[i];

        localBins[i] = {
          ...temp_bin,
          visible,
          path: null, // will hydrate below if visible
          global_index: i,
        };

        if (visible) {
          rangeArray.push({ global_index: i });
        }
      }
    };

    // CASE 1: no overlap, reset everything
    if (
      lastStart == null ||
      lastEnd == null ||
      upper_bound < lastStart ||
      lower_bound > lastEnd
    ) {
      localBins = {};
      addBins(lower_bound, upper_bound);

    } else {
      // shrink left
      if (lower_bound > lastStart) {
        for (let i = lastStart; i < lower_bound; i++) {
          delete localBins[i];
        }
      }

      // expand left
      if (lower_bound < lastStart) {
        addBins(lower_bound, lastStart - 1);
      }

      // expand right
      if (upper_bound > lastEnd) {
        addBins(lastEnd + 1, upper_bound);
      }

      // shrink right
      if (upper_bound < lastEnd) {
        for (let i = lastEnd; i > upper_bound; i--) {
          delete localBins[i];
        }
      }
    }

    // batch query once for all new bins
    if (rangeArray.length > 0) {
      const results = await queryNodes([], rangeArray);
      rangeArray.forEach(({ global_index }) => {
        localBins[global_index].path =
          results.paths[global_index] || null;
      });
    }

    lastStart = lower_bound;
    lastEnd = upper_bound;

    console.log("localBins", localBins);
    return localBins;
  };
}

const getLocalData = makeGetLocalData();

// ---------- hook ----------
const useRegions = ({ backend, globalBins, valueRef, viewState, saveViewports, globalBpPerUnit, tsconfig }) => {
  const { queryNodes } = backend;

  const [localBins, setLocalBins] = useState({});

  const debouncedQuery = useMemo(
    () =>
      debounce((val) => {
        const [lo, hi] = val;
        if (!globalBins) return;

        const zoom = viewState["ortho"]?.zoom?.[0];
        const width = saveViewports["ortho"]?.width;
        const nTrees = Math.floor(width / Math.pow(2, zoom));
        console.log("nTrees", nTrees, zoom, width)
        // compute and set bins directly
        getLocalData(lo, hi, globalBins, tsconfig, queryNodes, globalBpPerUnit ).then(
          (bins) => {
            setLocalBins((prev) => {
              if (Object.keys(prev).length === Object.keys(bins).length ) {
                return prev;
              }
              console.log("bins", bins);
              return bins; 
            });
          });
      }, 100),
    [queryNodes, globalBins, viewState]
  );

  useEffect(() => {
    if (globalBins && valueRef.current) {
      debouncedQuery(valueRef.current);
    }
  }, [globalBins, valueRef.current, debouncedQuery]);

  useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);

  const localCoordinates = useMemo(() => {
    if (!valueRef.current) return [];
    const [lo, hi] = valueRef.current;
    const bufferFrac = 0.2;
    const range = hi - lo;
    return getLocalCoordinates(lo - bufferFrac * range, hi + bufferFrac * range);
  }, [valueRef.current?.[0], valueRef.current?.[1]]);

  // useEffect(() => {
  //   const zoom = viewState["ortho"]?.zoom?.[0];
  //   const width = saveViewports["ortho"]?.width;
  //   if (zoom && width && globalBpPerUnit && globalBins) {
  //     const [lo, hi] = valueRef.current;

  //     const sampledTrees = sampleTrees(
  //       getXArray(globalBins),
  //       lo,
  //       hi,
  //       globalBpPerUnit
  //     );
  //     sampleTreesRef.current = sampledTrees;
  //     setLocalTrees(sampledTrees);
  //   }
  // }, [globalBins, globalBpPerUnit, valueRef.current, viewState, saveViewports]);

  return useMemo(
    () => ({
      bins: localBins,
      localCoordinates
    }),
    [localBins, localCoordinates]
  );
};

export default useRegions;
