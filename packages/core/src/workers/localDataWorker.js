import { new_complete_experiment_map } from './modules/binningUtils.js';
import { normalizeIntervalsFromConfig } from './modules/intervalUtils.js';

let normalizedIntervals = null;
let prevLocalBinsCache = null;

export function configureLocalDataWorker(config) {
  normalizedIntervals = normalizeIntervalsFromConfig(config);
  prevLocalBinsCache = null;
}

function serializeBinsForTransfer(bins) {
  return Array.from(bins.entries()).map(([key, value]) => ({
    key,
    ...value,
    modelMatrix: value.modelMatrix ? value.modelMatrix.toArray() : null
  }));
}

export function getLocalData(data) {
  const {
    lo = 0,
    hi = 0,
    start,
    end,
    globalBpPerUnit,
    new_globalBp,
    displayOptions = {}
  } = data;

  const { selectionStrategy = 'largestSpan' } = displayOptions;

  if (!normalizedIntervals || hi <= lo) {
    return {
      local_bins: [],
      displayArray: [],
      showing_all_trees: false
    };
  }

  const local_bins = new Map();

  for (let i = lo; i < hi - 1; i++) {
    const s = normalizedIntervals[i];
    const e = normalizedIntervals[i + 1];

    local_bins.set(i, {
      s,
      e,
      span: e - s,
      midpoint: (s + e) / 2,
      path: null,
      global_index: i,
      precision: null
    });
  }

  const minStart = normalizedIntervals[lo];
  const maxEnd = normalizedIntervals[Math.min(hi, normalizedIntervals.length - 1)];

  const { return_local_bins, displayArray, showingAllTrees } = new_complete_experiment_map(
    local_bins,
    globalBpPerUnit,
    new_globalBp,
    {
      selectionStrategy,
      viewportStart: start,
      viewportEnd: end,
      prevLocalBins: prevLocalBinsCache,
      minStart,
      maxEnd
    }
  );

  prevLocalBinsCache = return_local_bins;

  return {
    local_bins: serializeBinsForTransfer(return_local_bins),
    displayArray,
    showing_all_trees: showingAllTrees
  };
}

export function clearLocalDataWorkerState() {
  prevLocalBinsCache = null;
}

const workerScope = typeof self !== 'undefined' ? self : globalThis;

workerScope.onmessage = async (event) => {
  const { type, id, data } = event.data;

  if (type === 'config') {
    configureLocalDataWorker(data);
    workerScope.postMessage({ type: 'config', id, data: null });
  }

  if (type === 'local-data') {
    const result = getLocalData(data);
    workerScope.postMessage({ type: 'local-data', id, data: result });
  }
};
