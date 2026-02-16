import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearLocalDataWorkerState,
  configureLocalDataWorker,
  getLocalData
} from './localDataWorker.js';

describe('localDataWorker', () => {
  beforeEach(() => {
    clearLocalDataWorkerState();
  });

  it('builds local bins from lo/hi bounds without interval array round-trip', () => {
    configureLocalDataWorker({
      genome_length: 60,
      intervals: [0, 10, 20, 30, 40, 50, 60]
    });

    const result = getLocalData({
      lo: 1,
      hi: 5,
      start: 10,
      end: 50,
      globalBpPerUnit: 10,
      new_globalBp: 5,
      displayOptions: { selectionStrategy: 'largestSpan' }
    });

    expect(result.local_bins).toHaveLength(3);
    expect(result.displayArray).toEqual([1, 2, 3]);
    expect(result.showing_all_trees).toBe(true);

    const first = result.local_bins.find((bin) => bin.key === 1);
    expect(first?.s).toBe(10);
    expect(first?.e).toBe(20);
    expect(Array.isArray(first?.modelMatrix)).toBe(true);
  });

  it('returns empty output for invalid bounds', () => {
    configureLocalDataWorker({
      genome_length: 20,
      intervals: [0, 10, 20]
    });

    const result = getLocalData({
      lo: 2,
      hi: 2,
      start: 20,
      end: 20,
      globalBpPerUnit: 10,
      new_globalBp: 10,
      displayOptions: { selectionStrategy: 'largestSpan' }
    });

    expect(result).toEqual({
      local_bins: [],
      displayArray: [],
      showing_all_trees: false
    });
  });
});
