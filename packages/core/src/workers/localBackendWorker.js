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
 * Get visible intervals for a given viewport range
 * @param {number} start - Start position (bp)
 * @param {number} end - End position (bp)
 * @returns {Object} { visibleIntervals, lo, hi } - intervals and global index bounds
 */
function getIntervals(start, end) {
  if (!normalizedIntervals || normalizedIntervals.length === 0) {
    return { visibleIntervals: [], lo: 0, hi: 0 };
  }

  // Use cached normalized array - no more .map() per query
  const lower = nearestIndex(normalizedIntervals, start);
  const upper = upperBound(normalizedIntervals, end);

  return {
    visibleIntervals: normalizedIntervals.slice(lower, upper + 1),
    lo: lower,        // Global start index
    hi: upper + 1     // Global end index (exclusive)
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
 * Get local tree data from provided intervals
 * NOTE: Intervals are passed in (from useInterval), not recomputed here
 *
 * @param {Object} data
 * @param {number[]} data.intervals - Pre-decimation interval positions (from useInterval.allIntervalsInView)
 * @param {number} data.lo - Global start index (from getIntervals)
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
    intervals,
    lo = 0,  // Global start index
    start,
    end,
    globalBpPerUnit,
    new_globalBp,
    genome_length,
    
    displayOptions = {}
  } = data;

  const { selectionStrategy = 'largestSpan' , showing_all_trees = false} = displayOptions;

  if (!intervals || intervals.length === 0) {
    return {
      local_bins: [],
      displayArray: [],
      showing_all_trees: false
    };
  }

  // Build local_bins Map from provided intervals using GLOBAL indices
  // intervals includes both endpoints (N+1 breakpoints for N trees), so iterate to length-1
  // Tree i spans from intervals[i] to intervals[i+1]
  const local_bins = new Map();

  for (let i = 0; i < intervals.length - 1; i++) {
    const globalIndex = lo + i;  // Convert to global tree index
    const s = intervals[i];
    const e = intervals[i + 1];

    local_bins.set(globalIndex, {  // Key = global index
      s,
      e,
      span: e - s,
      midpoint: (s + e) / 2,
      path: null,
      global_index: globalIndex,   // GLOBAL tree index for backend
      precision: null
    });
  }

  // Apply binning/selection strategy
  const { return_local_bins, displayArray, showingAllTrees } = new_complete_experiment_map(
    local_bins,
    globalBpPerUnit,
    new_globalBp,
    { selectionStrategy, viewportStart: start, viewportEnd: end, prevLocalBins: prevLocalBinsCache, minStart: intervals[0], maxEnd: intervals[intervals.length - 1]}
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
    const { start, end } = data;
    const result = getIntervals(start, end);
    postMessage({ type: "intervals", id, data: result });  // { visibleIntervals, lo, hi }
  }

  if (type === "local-data") {
    const result = getLocalData(data);
    postMessage({ type: "local-data", id, data: result });
  }
};
