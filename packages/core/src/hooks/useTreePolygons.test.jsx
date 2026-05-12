/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTreePolygons } from './useTreePolygons.jsx';

describe('useTreePolygons hover no-ops', () => {
  it('ignores repeated hover updates for the same polygon key', () => {
    const onPolygonHover = vi.fn();
    const { result } = renderHook(() =>
      useTreePolygons({
        enabled: false,
        onPolygonHover
      })
    );

    act(() => {
      result.current.setHoveredPolygon(7);
      result.current.setHoveredPolygon(7);
    });

    expect(onPolygonHover).toHaveBeenCalledTimes(1);
    expect(onPolygonHover).toHaveBeenCalledWith(7);
  });

  it('still reports hover changes for different polygon keys', () => {
    const onPolygonHover = vi.fn();
    const { result } = renderHook(() =>
      useTreePolygons({
        enabled: false,
        onPolygonHover
      })
    );

    act(() => {
      result.current.setHoveredPolygon(7);
      result.current.setHoveredPolygon(8);
      result.current.setHoveredPolygon(null);
    });

    expect(onPolygonHover.mock.calls).toEqual([[7], [8], [null]]);
  });

  it('keeps polygon state stable for repeated hover on an already hovered key', async () => {
    const localBins = new Map([
      [7, {
        global_index: 7,
        s: 0,
        e: 5,
        visible: true,
        modelMatrix: [
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          1, 0, 0, 1
        ]
      }]
    ]);
    const fakeDeck = {
      getViewports: () => [
        {
          id: 'ortho',
          width: 100,
          height: 100,
          project: ([x, y]) => [x * 10, y * 100]
        },
        {
          id: 'genome-info',
          width: 100,
          height: 10,
          project: ([x]) => [x * 10, 0]
        }
      ]
    };

    const { result } = renderHook(() =>
      useTreePolygons({
        localBins,
        globalBpPerUnit: 1,
        viewState: { ortho: { target: [0, 0], zoom: [0, 0] } },
        enabled: true,
        animate: false
      })
    );

    act(() => {
      result.current._cacheViewports(fakeDeck);
    });

    await waitFor(() => {
      expect(result.current.polygons).toHaveLength(1);
    });

    act(() => {
      result.current.setHoveredPolygon(7);
    });

    await waitFor(() => {
      expect(result.current.polygons[0]?.isHovered).toBe(true);
    });

    const polygonsAfterFirstHover = result.current.polygons;

    act(() => {
      result.current.setHoveredPolygon(7);
    });

    expect(result.current.polygons).toBe(polygonsAfterFirstHover);
  });
});
