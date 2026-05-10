/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTimePositions } from '@lorax/core/src/hooks/useTimePositions.jsx';

const viewState = {
  zoom: [0, 8],
  target: [0, 0.5]
};

describe('useTimePositions', () => {
  it('keeps the existing linear boundary mapping', () => {
    const { result } = renderHook(() => useTimePositions({
      minTime: 0,
      maxTime: 100,
      viewState,
      viewHeight: 256,
      timeScale: 'linear'
    }));

    expect(result.current[0]).toMatchObject({ time: 0, y: 1, text: '0' });
    expect(result.current.at(-1)).toMatchObject({ time: 100, y: 0, text: '100' });
  });

  it('positions interior labels using log scale', () => {
    const { result } = renderHook(() => useTimePositions({
      minTime: 0,
      maxTime: 100,
      viewState,
      viewHeight: 256,
      timeScale: 'log'
    }));

    const tick = result.current.find((entry) => entry.time === 20);
    expect(tick?.y).toBeCloseTo(1 - Math.log1p(20) / Math.log1p(100), 5);
  });
});
