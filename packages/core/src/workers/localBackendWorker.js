import { nearestIndex, upperBound, new_complete_experiment_map } from "./modules/binningUtils.js";

let tsconfig = null;
let normalizedIntervals = null;  // Cached normalized array - computed once when config is set
let prevLocalBinsCache = null;   // Cache previous frame's bins for position locking

export const queryConfig = async (data) => {
  tsconfig = data.data;

  // Normalize intervals ONCE when config is set (not on every query)
  if (tsconfig?.intervals) {
    let intervals = tsconfig.intervals;
    if (intervals.length > 0 && Array.isArray(intervals[0])) {
      normalizedIntervals = intervals.map(interval => interval[0]);
    } else {
      normalizedIntervals = intervals;
    }
  } else {
    normalizedIntervals = [];
  }
};

/**
 * Get visible intervals for a given viewport range.
 * Returns only decimated intervals for display (max maxIntervals) plus lo/hi bounds.
 * The full interval array stays in the worker — useLocalData uses lo/hi to reference it.
 *
 * @param {number} start - Start position (bp)
 * @param {number} end - End position (bp)
 * @param {number} maxIntervals - Max intervals to return for display (LOD threshold)
 * @returns {Object} { visibleIntervals, lo, hi, count }
 */
function getIntervals(start, end, maxIntervals = 2000) {
  if (!normalizedIntervals || normalizedIntervals.length === 0) {
    return { visibleIntervals: [], lo: 0, hi: 0, count: 0 };
  }

  // Use cached normalized array - no more .map() per query
  const lower = nearestIndex(normalizedIntervals, start);
  const upper = upperBound(normalizedIntervals, end);
  const lo = lower;
  const hi = upper + 1;  // Exclusive end
  const fullSlice = normalizedIntervals.slice(lo, hi);
  const count = fullSlice.length;

  // Apply LOD decimation in worker to avoid sending huge arrays via postMessage
  let visibleIntervals;
  if (count > maxIntervals) {
    const step = Math.ceil(count / maxIntervals);
    visibleIntervals = [];
    for (let i = 0; i < count; i += step) {
      visibleIntervals.push(fullSlice[i]);
    }
  } else {
    visibleIntervals = fullSlice;
  }

  return {
    visibleIntervals,  // Decimated for display only
    lo,
    hi,
    count             // Pre-decimation count for downstream hooks
  };
}

/**
 * Serialize Map for postMessage transfer
 * Maps and Matrix4 cannot be transferred directly via postMessage
 */
function serializeBinsForTransfer(bins) {
  return Array.from(bins.entries()).map(([key, value]) => ({
    key,
    ...value,
    modelMatrix: value.modelMatrix ? value.modelMatrix.toArray() : null
  }));
}

/**
 * Get local tree data using cached normalizedIntervals and lo/hi bounds.
 * Avoids round-tripping the full intervals array through postMessage.
 *
 * @param {Object} data
 * @param {number} data.lo - Global start index (inclusive)
 * @param {number} data.hi - Global end index (exclusive)
 * @param {number} data.start - Start genomic position (bp) - viewport bounds
 * @param {number} data.end - End genomic position (bp) - viewport bounds
 * @param {number} data.globalBpPerUnit - Base pairs per unit
 * @param {number} data.new_globalBp - Zoom-adjusted bp per unit
 * @param {number} data.genome_length - Total genome length (for last bin end)
 * @param {Object} data.displayOptions - { selectionStrategy }
 * @returns {Object} { local_bins, displayArray, showing_all_trees }
 */
function getLocalData(data) {
  const {
    lo = 0,
    hi = 0,
    start,
    end,
    globalBpPerUnit,
    new_globalBp,
    genome_length,

    displayOptions = {}
  } = data;

  const { selectionStrategy = 'largestSpan' , showing_all_trees = false} = displayOptions;

  if (!normalizedIntervals || hi <= lo) {
    return {
      local_bins: [],
      displayArray: [],
      showing_all_trees: false
    };
  }

  // Use cached normalizedIntervals directly — no postMessage round-trip needed
  // Interval range [lo, hi) maps to normalizedIntervals[lo..hi]
  // Tree i spans from normalizedIntervals[i] to normalizedIntervals[i+1]
  const local_bins = new Map();

  for (let i = lo; i < hi - 1; i++) {
    const s = normalizedIntervals[i];
    const e = normalizedIntervals[i + 1];

    local_bins.set(i, {  // Key = global index
      s,
      e,
      span: e - s,
      midpoint: (s + e) / 2,
      path: null,
      global_index: i,
      precision: null
    });
  }

  // Apply binning/selection strategy
  const minStart = normalizedIntervals[lo];
  const maxEnd = normalizedIntervals[Math.min(hi, normalizedIntervals.length - 1)];
  const { return_local_bins, displayArray, showingAllTrees } = new_complete_experiment_map(
    local_bins,
    globalBpPerUnit,
    new_globalBp,
    { selectionStrategy, viewportStart: start, viewportEnd: end, prevLocalBins: prevLocalBinsCache, minStart, maxEnd }
  );

  // Cache for next frame's position locking
  prevLocalBinsCache = return_local_bins;

  return {
    local_bins: serializeBinsForTransfer(return_local_bins),
    displayArray,
    showing_all_trees: showingAllTrees
  };
}

onmessage = async (event) => {
  const { type, id, data } = event.data;

  if (type === "config") {
    await queryConfig({ data });
    postMessage({ type: "config", id, data: null });
  }

  if (type === "intervals") {
    const { start, end, maxIntervals } = data;
    const result = getIntervals(start, end, maxIntervals);
    postMessage({ type: "intervals", id, data: result });  // { visibleIntervals, lo, hi, count }
  }

  if (type === "local-data") {
    const result = getLocalData(data);
    postMessage({ type: "local-data", id, data: result });
  }
};
