/**
 * Pure computation functions for tree binning and interval queries.
 * These functions can run on either main thread or web worker.
 *
 * Re-exports core algorithms from binningUtils.js for direct use,
 * plus provides synchronous query functions for main-thread mode.
 */

import {
  lowerBound,
  upperBound,
  nearestIndex,
  selectionStrategies,
  getSelectionStrategy,
  new_complete_experiment_map
} from '../workers/modules/binningUtils.js';

// Re-export all core functions from binningUtils
export {
  lowerBound,
  upperBound,
  nearestIndex,
  selectionStrategies,
  getSelectionStrategy,
  new_complete_experiment_map
};

// Module-level cache for position locking (main-thread mode)
let prevLocalBinsCache = null;

/**
 * Normalize intervals array (handle [start, end] tuples if present)
 * @param {Array} intervals - Raw intervals (may be tuples or flat array)
 * @returns {number[]} Flat array of interval start positions
 */
export function normalizeIntervals(intervals) {
  if (!intervals || intervals.length === 0) return [];

  // Handle [start, end] tuple format
  if (Array.isArray(intervals[0])) {
    return intervals.map(interval => interval[0]);
  }
  return intervals;
}

/**
 * Query intervals for a given viewport range (synchronous)
 *
 * @param {number[]} normalizedIntervals - Pre-normalized interval positions
 * @param {number} start - Start position (bp)
 * @param {number} end - End position (bp)
 * @returns {Object} { visibleIntervals, lo, hi }
 */
export function queryIntervalsSync(normalizedIntervals, start, end) {
  if (!normalizedIntervals || normalizedIntervals.length === 0) {
    return { visibleIntervals: [], lo: 0, hi: 0 };
  }

  const lower = nearestIndex(normalizedIntervals, start);
  const upper = upperBound(normalizedIntervals, end);

  return {
    visibleIntervals: normalizedIntervals.slice(lower, upper + 1),
    lo: lower,
    hi: upper + 1
  };
}

/**
 * Compute local bins and tree positioning (synchronous)
 *
 * This is the main-thread equivalent of localBackendWorker's getLocalData.
 *
 * @param {Object} params
 * @param {number[]} params.intervals - Pre-decimation interval positions
 * @param {number} params.lo - Global start index
 * @param {number} params.start - Start genomic position (bp)
 * @param {number} params.end - End genomic position (bp)
 * @param {number} params.globalBpPerUnit - Base pairs per unit
 * @param {number} params.new_globalBp - Zoom-adjusted bp per unit
 * @param {number} params.genome_length - Total genome length
 * @param {Object} params.displayOptions - { selectionStrategy }
 * @returns {Object} { local_bins, displayArray, showing_all_trees }
 */
export function queryLocalDataSync({
  intervals,
  lo = 0,
  start,
  end,
  globalBpPerUnit,
  new_globalBp,
  genome_length,
  displayOptions = {}
}) {
  const { selectionStrategy = 'largestSpan' } = displayOptions;

  if (!intervals || intervals.length === 0) {
    return {
      local_bins: new Map(),
      displayArray: [],
      showing_all_trees: false
    };
  }

  // Build local_bins Map from provided intervals using GLOBAL indices
  // intervals includes both endpoints (N+1 breakpoints for N trees), so iterate to length-1
  // Tree i spans from intervals[i] to intervals[i+1]
  const local_bins = new Map();

  for (let i = 0; i < intervals.length - 1; i++) {
    const globalIndex = lo + i;
    const s = intervals[i];
    const e = intervals[i + 1];

    local_bins.set(globalIndex, {
      s,
      e,
      span: e - s,
      midpoint: (s + e) / 2,
      path: null,
      global_index: globalIndex,
      precision: null
    });
  }

  // Apply binning/selection strategy
  const { return_local_bins, displayArray, showingAllTrees } = new_complete_experiment_map(
    local_bins,
    globalBpPerUnit,
    new_globalBp,
    { selectionStrategy, viewportStart: start, viewportEnd: end, prevLocalBins: prevLocalBinsCache }
  );

  // Cache for next frame's position locking
  prevLocalBinsCache = return_local_bins;

  return {
    local_bins: return_local_bins,
    displayArray,
    showing_all_trees: showingAllTrees
  };
}

/**
 * Serialize Map of bins for transfer/storage
 * Converts Map and Matrix4 objects to transferable arrays
 *
 * @param {Map} bins - Map of tree index -> bin data with modelMatrix
 * @returns {Array} Serialized array of bin objects
 */
export function serializeBinsForTransfer(bins) {
  if (!bins || !(bins instanceof Map)) return [];

  return Array.from(bins.entries()).map(([key, value]) => ({
    key,
    ...value,
    modelMatrix: value.modelMatrix ? value.modelMatrix.toArray() : null
  }));
}

/**
 * Deserialize bins from serialized format back to Map
 *
 * @param {Array} serialized - Serialized array of bin objects
 * @returns {Map|null} Map of tree index -> bin data
 */
export function deserializeBins(serialized) {
  if (!serialized || !Array.isArray(serialized)) return null;

  const map = new Map();
  for (const item of serialized) {
    const { key, ...rest } = item;
    map.set(key, {
      ...rest,
      // Keep modelMatrix as array - consumer can convert to Matrix4 if needed
      modelMatrix: rest.modelMatrix
    });
  }
  return map;
}

/**
 * Check if environment supports web workers with inline modules
 * Used to determine whether to use worker mode or main-thread mode
 *
 * @returns {boolean} True if workers are supported
 */
export function supportsWebWorkers() {
  // Check for Worker constructor
  if (typeof Worker === 'undefined') {
    return false;
  }

  // Check if we're in a Vite environment (has import.meta)
  // Vite's ?worker&inline syntax only works in Vite builds
  try {
    // import.meta is available in ES modules
    return typeof import.meta !== 'undefined' && typeof import.meta.url !== 'undefined';
  } catch {
    return false;
  }
}
