import { nearestIndex, upperBound } from "./modules/binningUtils.js";

let tsconfig = null;

export const queryConfig = async (data) => {
  tsconfig = data.data;
};

/**
 * Get visible intervals for a given viewport range
 * @param {number} start - Start position (bp)
 * @param {number} end - End position (bp)
 * @returns {number[]} Array of interval positions in range
 */
function getIntervals(start, end) {
  if (!tsconfig?.intervals) return [];

  let intervalStarts = tsconfig.intervals;
  if (intervalStarts.length > 0 && Array.isArray(intervalStarts[0])) {
    intervalStarts = intervalStarts.map(interval => interval[0]);
  }

  const lower = nearestIndex(intervalStarts, start);
  const upper = upperBound(intervalStarts, end);

  return intervalStarts.slice(lower, upper + 1);
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
