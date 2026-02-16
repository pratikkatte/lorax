/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useInterval } from './useInterval.jsx';

describe('useInterval interaction decimation', () => {
  it('uses previewMaxIntervals while interacting and full maxIntervals once idle', async () => {
    const worker = {
      request: vi
        .fn()
        .mockResolvedValueOnce({
          visibleIntervals: [100, 200],
          lo: 10,
          hi: 510,
          count: 500
        })
        .mockResolvedValueOnce({
          visibleIntervals: [100, 180, 260],
          lo: 10,
          hi: 510,
          count: 500
        })
    };

    const baseProps = {
      worker,
      workerConfigReady: true,
      genomicCoords: [1000, 2000],
      debounceMs: 0,
      maxIntervals: 2000,
      previewMaxIntervals: 400
    };

    const { result, rerender } = renderHook((props) => useInterval(props), {
      initialProps: {
        ...baseProps,
        isInteracting: true
      }
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(1));
    expect(worker.request.mock.calls[0][1]).toMatchObject({
      maxIntervals: 400
    });

    await waitFor(() => expect(result.current.intervalCount).toBe(500));
    expect(result.current.visibleIntervals).toEqual([100, 200]);

    rerender({
      ...baseProps,
      isInteracting: false
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(2));
    expect(worker.request.mock.calls[1][1]).toMatchObject({
      maxIntervals: 2000
    });
  });
});
