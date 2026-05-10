export const TIME_SCALE_LINEAR = 'linear';
export const TIME_SCALE_LOG = 'log';

export function normalizeTimeScale(timeScale) {
  return timeScale === TIME_SCALE_LOG ? TIME_SCALE_LOG : TIME_SCALE_LINEAR;
}

export function timeToY(time, minTime, maxTime, timeScale = TIME_SCALE_LINEAR) {
  const range = maxTime - minTime;
  if (!Number.isFinite(range) || range <= 0) return 1;

  const offset = Math.min(Math.max(time - minTime, 0), range);
  if (normalizeTimeScale(timeScale) === TIME_SCALE_LOG) {
    const denominator = Math.log1p(range);
    if (!Number.isFinite(denominator) || denominator <= 0) return 1;
    return 1 - Math.log1p(offset) / denominator;
  }

  return 1 - offset / range;
}

export function yToTime(y, minTime, maxTime, timeScale = TIME_SCALE_LINEAR) {
  const range = maxTime - minTime;
  if (!Number.isFinite(range) || range <= 0) return minTime;

  const normalizedY = Math.min(Math.max(y, 0), 1);
  const normalizedOffset = 1 - normalizedY;
  if (normalizeTimeScale(timeScale) === TIME_SCALE_LOG) {
    return minTime + Math.expm1(normalizedOffset * Math.log1p(range));
  }

  return minTime + normalizedOffset * range;
}
