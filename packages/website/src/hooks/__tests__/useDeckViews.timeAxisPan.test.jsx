/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@deck.gl/core', () => ({
  OrthographicController: class {
    handleEvent() {
      return true;
    }
  },
  OrthographicView: class {
    constructor(options) {
      Object.assign(this, options);
    }
  }
}));

import { useDeckViews } from '@lorax/core/src/hooks/useDeckViews.jsx';

const viewConfig = {
  ortho: { enabled: true, x: '5%', y: '5%', width: '95%', height: '95%' },
  genomeInfo: { enabled: true, x: '5%', y: '3%', width: '95%', height: '2%' },
  genomePositions: { enabled: true, x: '5%', y: '0%', width: '95%', height: '3%' },
  treeTime: { enabled: true, x: '0%', y: '3%', width: '5%', height: '97%' }
};

function renderUseDeckViews() {
  return renderHook(() => useDeckViews({
    viewConfig,
    enabledViews: ['ortho', 'genome-positions', 'genome-info', 'tree-time'],
    zoomAxis: 'Y',
    panDirection: null,
    wheelPanDeltaX: 0,
    globalBpPerUnit: null,
    genomeLength: null,
    tsconfigValue: null,
    isInteracting: false
  }));
}

describe('useDeckViews time-axis wheel panning', () => {
  it('pans ortho and tree-time Y targets from wheel delta while preserving X and zoom state', () => {
    const { result } = renderUseDeckViews();

    act(() => {
      result.current.panYByWheelDelta(64);
    });

    expect(result.current.viewState.ortho.target[0]).toBe(0);
    expect(result.current.viewState.ortho.target[1]).toBeCloseTo(0.25);
    expect(result.current.viewState.ortho.zoom).toEqual([5, 8]);

    expect(result.current.viewState['tree-time'].target[0]).toBe(0.5);
    expect(result.current.viewState['tree-time'].target[1]).toBeCloseTo(0.25);
    expect(result.current.viewState['tree-time'].zoom).toEqual([0, 8]);

    expect(result.current.viewState['genome-positions'].target).toEqual([0, 1]);
    expect(result.current.viewState['genome-info'].target).toEqual([0, 1]);
  });

  it('clamps vertical wheel panning to normalized Y bounds', () => {
    const { result } = renderUseDeckViews();

    act(() => {
      result.current.panYByWheelDelta(4096);
    });
    expect(result.current.viewState.ortho.target[1]).toBe(1);
    expect(result.current.viewState['tree-time'].target[1]).toBe(1);

    act(() => {
      result.current.panYByWheelDelta(-8192);
    });
    expect(result.current.viewState.ortho.target[1]).toBe(0);
    expect(result.current.viewState['tree-time'].target[1]).toBe(0);
  });
});
