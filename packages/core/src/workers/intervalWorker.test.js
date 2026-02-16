import { describe, expect, it } from 'vitest';

import { normalizeIntervals, queryIntervalsSync } from '../utils/computations.js';
import { configureIntervalWorker, getIntervals } from './intervalWorker.js';

describe('intervalWorker', () => {
  it('matches lo/hi/count with sync query and applies decimation', () => {
    const config = {
      intervals: [
        [0, 10],
        [10, 20],
        [20, 30],
        [30, 40],
        [40, 50],
        [50, 60]
      ]
    };

    configureIntervalWorker(config);

    const normalized = normalizeIntervals(config.intervals);
    const expected = queryIntervalsSync(normalized, 5, 35);
    const result = getIntervals(5, 35, 2);

    expect(result.lo).toBe(expected.lo);
    expect(result.hi).toBe(expected.hi);
    expect(result.count).toBe(expected.visibleIntervals.length);
    expect(result.visibleIntervals.length).toBeLessThanOrEqual(2);
    expect(result.visibleIntervals[0]).toBe(expected.visibleIntervals[0]);
  });

  it('returns an empty response without configured intervals', () => {
    configureIntervalWorker({ intervals: [] });

    expect(getIntervals(0, 100, 10)).toEqual({
      visibleIntervals: [],
      lo: 0,
      hi: 0,
      count: 0
    });
  });
});
