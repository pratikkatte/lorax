/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocalData } from '@lorax/core/src/hooks/useLocalData.jsx';

function createViewState(xZoom) {
  return {
    ortho: {
      zoom: [xZoom, 8],
      target: [0, 0]
    }
  };
}

function createWorker() {
  return {
    request: vi.fn().mockResolvedValue({
      local_bins: [],
      displayArray: [],
      showing_all_trees: false
    })
  };
}

function createBaseProps(worker) {
  return {
    worker,
    workerConfigReady: true,
    intervalBounds: { lo: 0, hi: 3 },
    intervalsCoords: [0, 100],
    genomicCoords: [0, 100],
    viewState: createViewState(8),
    tsconfig: {
      genome_length: 1_000,
      intervals: [0, 100, 200, 300]
    },
    displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: false },
    mode: 'worker'
  };
}

describe('useLocalData lockModelMatrix', () => {
  it('recomputes on X-zoom change when lock is disabled', async () => {
    const worker = createWorker();
    const { rerender } = renderHook((props) => useLocalData(props), {
      initialProps: createBaseProps(worker)
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(1));

    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: false }
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(2));
  });

  it('skips recompute on X-zoom change when lock is enabled', async () => {
    const worker = createWorker();
    const { rerender } = renderHook((props) => useLocalData(props), {
      initialProps: {
        ...createBaseProps(worker),
        displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
      }
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(1));

    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(worker.request).toHaveBeenCalledTimes(1);
  });

  it('recomputes on horizontal pan when lock is enabled', async () => {
    const worker = createWorker();
    const { rerender } = renderHook((props) => useLocalData(props), {
      initialProps: {
        ...createBaseProps(worker),
        displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
      }
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(1));

    rerender({
      ...createBaseProps(worker),
      genomicCoords: [10, 110],
      intervalsCoords: [10, 110],
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(2));
  });

  it('resumes recompute after unlocking following a skipped zoom', async () => {
    const worker = createWorker();
    const { rerender } = renderHook((props) => useLocalData(props), {
      initialProps: {
        ...createBaseProps(worker),
        displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
      }
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(1));

    // Zoom change while locked => skip recompute.
    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(worker.request).toHaveBeenCalledTimes(1);

    // Unlock at same zoom => recompute resumes.
    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: false }
    });
    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(2));
  });

  it('skips the first zoom-driven window update and recomputes on subsequent pan', async () => {
    const worker = createWorker();
    const { rerender } = renderHook((props) => useLocalData(props), {
      initialProps: {
        ...createBaseProps(worker),
        displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
      }
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(1));

    // Locked zoom event.
    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(worker.request).toHaveBeenCalledTimes(1);

    // First compute-ready genomic window update after zoom (zoom-driven) is skipped.
    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      genomicCoords: [5, 95],
      intervalsCoords: [5, 95],
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(worker.request).toHaveBeenCalledTimes(1);

    // Duplicate compute-ready pass for the same zoom-driven window should remain skipped.
    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      genomicCoords: [5, 95],
      intervalsCoords: [5, 95],
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(worker.request).toHaveBeenCalledTimes(1);

    // Next horizontal movement (pan) recomputes.
    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      genomicCoords: [10, 110],
      intervalsCoords: [10, 110],
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });
    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(2));
  });

  it('does not recompute for pan that stays inside the lock snapshot window after zoom', async () => {
    const worker = createWorker();
    const { rerender } = renderHook((props) => useLocalData(props), {
      initialProps: {
        ...createBaseProps(worker),
        displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
      }
    });

    await waitFor(() => expect(worker.request).toHaveBeenCalledTimes(1));

    // Zoom while locked => suppress updates.
    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(worker.request).toHaveBeenCalledTimes(1);

    // Pan but remain fully inside original lock window [0, 100] => still suppressed.
    rerender({
      ...createBaseProps(worker),
      viewState: createViewState(9),
      genomicCoords: [2, 98],
      intervalsCoords: [2, 98],
      displayOptions: { selectionStrategy: 'largestSpan', lockModelMatrix: true }
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(worker.request).toHaveBeenCalledTimes(1);
  });
});
