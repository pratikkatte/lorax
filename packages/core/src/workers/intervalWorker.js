import { buildIntervalsResponse, normalizeIntervalsFromConfig } from './modules/intervalUtils.js';

let normalizedIntervals = null;

export function configureIntervalWorker(config) {
  normalizedIntervals = normalizeIntervalsFromConfig(config);
}

export function getIntervals(start, end, maxIntervals = 2000) {
  if (!normalizedIntervals || normalizedIntervals.length === 0) {
    return { visibleIntervals: [], lo: 0, hi: 0, count: 0 };
  }
  return buildIntervalsResponse(normalizedIntervals, start, end, maxIntervals);
}

const workerScope = typeof self !== 'undefined' ? self : globalThis;

workerScope.onmessage = async (event) => {
  const { type, id, data } = event.data;

  if (type === 'config') {
    configureIntervalWorker(data);
    workerScope.postMessage({ type: 'config', id, data: null });
  }

  if (type === 'intervals') {
    const { start, end, maxIntervals } = data;
    const result = getIntervals(start, end, maxIntervals);
    workerScope.postMessage({ type: 'intervals', id, data: result });
  }
};
