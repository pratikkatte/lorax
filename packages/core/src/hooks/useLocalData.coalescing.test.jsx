/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useLocalData } from './useLocalData.jsx';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createViewState(xZoom = 8) {
  return {
    ortho: {
      zoom: [xZoom, 8],
      target: [0, 0]
    }
  };
}

function createBaseProps(worker) {
  return {
    worker,
    workerConfigReady: true,
    intervalBounds: { lo: 0, hi: 4 },
    intervalsCoords: [0, 100],
    genomicCoords: [0, 100],
    viewState: createViewState(8),
    tsconfig: {
      genome_length: 1_000,
      intervals: [0, 100, 200, 300, 400]
    },
    displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: false }
  };
}

describe('useLocalData request coalescing', () => {
  it('keeps one in-flight request and executes only the latest queued update', async () => {
    const first = deferred();
    const second = deferred();
    const worker = {
      request: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    };

    const { result, rerender } = renderHook((props) => useLocalData(props), {
      initialProps: createBaseProps(worker)
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(1));

    // Queue multiple updates while first request is still in flight.
    rerender({
      ...createBaseProps(worker),
      genomicCoords: [10, 110],
      intervalsCoords: [10, 110]
    });
    rerender({
      ...createBaseProps(worker),
      genomicCoords: [20, 120],
      intervalsCoords: [20, 120]
    });
    // Duplicate of the latest update should not enqueue extra work.
    rerender({
      ...createBaseProps(worker),
      genomicCoords: [20, 120],
      intervalsCoords: [20, 120]
    });

    expect(worker.request).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({
        local_bins: [],
        displayArray: [1],
        showing_all_trees: false
      });
      await first.promise;
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(2));
    expect(worker.request.mock.calls[1][1]).toMatchObject({
      start: 20,
      end: 120
    });

    // First response is stale because a newer request was queued.
    expect(result.current.displayArray).toEqual([]);

    await act(async () => {
      second.resolve({
        local_bins: [],
        displayArray: [2],
        showing_all_trees: false
      });
      await second.promise;
    });

    await waitFor(() => expect(result.current.displayArray).toEqual([2]));
    expect(worker.request).toHaveBeenCalledTimes(2);
  });
});

