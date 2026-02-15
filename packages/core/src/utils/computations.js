/**
 * Shared binning and interval query utilities.
 * Re-exports core algorithms from binningUtils.js.
 */

import {
  lowerBound,
  upperBound,
  nearestIndex,
  selectionStrategies,
  getSelectionStrategy,
  new_complete_experiment_map
} from '../workers/modules/binningUtils.js';

// Re-export core functions from binningUtils
export {
  lowerBound,
  upperBound,
  nearestIndex,
  selectionStrategies,
  getSelectionStrategy,
  new_complete_experiment_map
};

/**
 * Normalize intervals array (handle [start, end] tuples if present).
 * @param {Array} intervals - Raw intervals (may be tuples or flat array)
 * @returns {number[]} Flat array of interval start positions
 */
export function normalizeIntervals(intervals) {
  if (!intervals || intervals.length === 0) return [];

  // Handle [start, end] tuple format
  if (Array.isArray(intervals[0])) {
    return intervals.map((interval) => interval[0]);
  }
  return intervals;
}

/**
 * Query intervals for a given viewport range (synchronous).
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
