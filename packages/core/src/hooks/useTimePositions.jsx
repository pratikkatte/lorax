import { useMemo } from 'react';
import { niceStep } from '../utils/genomeCoordinates.js';
import { normalizeTimeScale, timeToY, yToTime } from '../utils/timeScale.js';

/**
 * Compute time axis tick positions for the tree-time view
 *
 * @param {Object} params
 * @param {number} params.minTime - Minimum time value (tips/present)
 * @param {number} params.maxTime - Maximum time value (root/oldest)
 * @param {Object} params.viewState - tree-time view state with zoom and target
 * @param {number} params.viewHeight - Height of tree-time view in pixels
 * @param {string} params.timeScale - Time scale: "linear" or "log"
 * @returns {Array<{time: number, y: number, text: string}>} Array of tick positions
 */
export function useTimePositions({ minTime, maxTime, viewState, viewHeight, timeScale = 'linear' }) {
  return useMemo(() => {
    // Validate inputs
    if (minTime == null || maxTime == null || minTime >= maxTime) return [];
    if (!viewState?.zoom || !viewState?.target) return [];
    if (!viewHeight || viewHeight <= 0) return [];

    const resolvedTimeScale = normalizeTimeScale(timeScale);
    const [, yZoom] = viewState.zoom;
    const [, yTarget] = viewState.target;

    // Calculate visible Y range in normalized [0, 1] coordinates
    // Based on orthographic projection: visibleHeight = viewHeight / 2^zoom
    const visibleYHeight = viewHeight / Math.pow(2, yZoom);
    const yMin = Math.max(0, yTarget - visibleYHeight / 2);
    const yMax = Math.min(1, yTarget + visibleYHeight / 2);

    const visibleTimeMax = yToTime(yMin, minTime, maxTime, resolvedTimeScale);
    const visibleTimeMin = yToTime(yMax, minTime, maxTime, resolvedTimeScale);
    const visibleTimeRange = visibleTimeMax - visibleTimeMin;

    if (visibleTimeRange <= 0) return [];

    // Get nice tick positions using same approach as genome positions
    const timePositions = getLocalTimeCoordinates(visibleTimeMin, visibleTimeMax);

    // Map time values to Y positions and format labels
    const ticks = [];
    for (const time of timePositions) {
      // Skip if outside the global time range
      if (time < minTime || time > maxTime) continue;

      const normalizedY = timeToY(time, minTime, maxTime, resolvedTimeScale);

      // Skip values too close to boundaries
      if (normalizedY < 0.02 || normalizedY > 0.98) continue;

      ticks.push({
        time,
        y: normalizedY,  // y=1 at minTime (bottom), y=0 at maxTime (top)
        text: formatTime(time)
      });
    }

    // Add boundary ticks for min and max time
    ticks.unshift({
      time: minTime,
      y: 1,  // minTime at bottom
      text: formatTime(minTime)
    });
    ticks.push({
      time: maxTime,
      y: 0,  // maxTime at top
      text: formatTime(maxTime)
    });

    return ticks;
  }, [minTime, maxTime, viewState, viewHeight, timeScale]);
}

/**
 * Compute nice coordinate positions for a time range
 * Similar to getLocalCoordinates but for time values
 *
 * @param {number} lo - Start of range
 * @param {number} hi - End of range
 * @returns {number[]} Array of nice coordinate values
 */
function getLocalTimeCoordinates(lo, hi) {
  const range = hi - lo;
  if (range <= 0) return [];

  // Fixed number of ticks for consistent vertical axis density
  const divisions = 7;
  const rawStep = range / divisions;
  const stepSize = niceStep(rawStep);

  const start = Math.ceil(lo / stepSize) * stepSize;
  const end = Math.floor(hi / stepSize) * stepSize;
  const n = Math.floor((end - start) / stepSize) + 1;

  if (n <= 0) return [];

  return Array.from({ length: n }, (_, i) => start + i * stepSize);
}

/**
 * Format a time value for display
 * @param {number} value - Time value
 * @returns {string} Formatted string
 */
function formatTime(value) {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(value) >= 10_000) return (value / 1_000).toFixed(1) + 'K';
  if (Math.abs(value) >= 1000) return (value / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}
