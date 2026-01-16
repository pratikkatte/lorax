import { nearestIndex, upperBound } from "./modules/binningUtils.js";

let tsconfig = null;
let normalizedIntervals = null;  // Cached normalized array - computed once when config is set

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
 * @returns {number[]} Array of interval positions in range
 */
function getIntervals(start, end) {
  if (!normalizedIntervals || normalizedIntervals.length === 0) return [];

  // Use cached normalized array - no more .map() per query
  const lower = nearestIndex(normalizedIntervals, start);
  const upper = upperBound(normalizedIntervals, end);

  return normalizedIntervals.slice(lower, upper + 1);
}

onmessage = async (event) => {
  const { type, id, data } = event.data;

  if (type === "config") {
    await queryConfig({ data });
    postMessage({ type: "config", id, data: null });
  }

  if (type === "intervals") {
    const { start, end } = data;
    const visibleIntervals = getIntervals(start, end);
    postMessage({ type: "intervals", id, data: { visibleIntervals } });
  }
};
