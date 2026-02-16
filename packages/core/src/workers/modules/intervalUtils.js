import { nearestIndex, upperBound } from './binningUtils.js';

/**
 * Normalize tsconfig intervals into a flat, sorted array of breakpoint starts.
 * Supports either [start, end] tuples or already-flat numeric arrays.
 */
export function normalizeIntervalsFromConfig(config) {
  const intervals = config?.intervals;
  if (!Array.isArray(intervals) || intervals.length === 0) return [];
  if (Array.isArray(intervals[0])) {
    return intervals.map((interval) => interval[0]);
  }
  return intervals;
}

/**
 * Compute global [lo, hi) bounds for a viewport against a normalized interval array.
 */
export function getIntervalBoundsForViewport(normalizedIntervals, start, end) {
  if (!Array.isArray(normalizedIntervals) || normalizedIntervals.length === 0) {
    return { lo: 0, hi: 0, count: 0 };
  }

  const lo = nearestIndex(normalizedIntervals, start);
  const hi = upperBound(normalizedIntervals, end) + 1;
  const count = Math.max(0, hi - lo);

  return { lo, hi, count };
}

/**
 * Return a decimated subset used for viewport line rendering.
 */
export function decimateIntervals(intervals, maxIntervals = 2000) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];
  if (!Number.isFinite(maxIntervals) || maxIntervals <= 0) return [];
  if (intervals.length <= maxIntervals) return intervals;

  const step = Math.ceil(intervals.length / maxIntervals);
  const decimated = [];
  for (let i = 0; i < intervals.length; i += step) {
    decimated.push(intervals[i]);
  }
  return decimated;
}

/**
 * Build the worker response payload for interval queries.
 */
export function buildIntervalsResponse(normalizedIntervals, start, end, maxIntervals = 2000) {
  const { lo, hi, count } = getIntervalBoundsForViewport(normalizedIntervals, start, end);
  if (count === 0) {
    return { visibleIntervals: [], lo: 0, hi: 0, count: 0 };
  }

  const slice = normalizedIntervals.slice(lo, hi);
  return {
    visibleIntervals: decimateIntervals(slice, maxIntervals),
    lo,
    hi,
    count
  };
}
