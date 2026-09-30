import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDeckLayers } from '@lorax/core/src/hooks/useDeckLayers.jsx';

describe('picking transitions between tree layers', () => {
  it('clears ancestral hover when moving directly from an edge to a tip', () => {
    const onEdgeHover = vi.fn();
    const onTipHover = vi.fn();
    const edge = { tree_idx: 0, parent_id: 2, child_id: 1 };
    const tip = { tree_idx: 0, node_id: 1 };
    const { result } = renderHook(() => useDeckLayers({
      enabledViews: ['ortho'], renderData: { edgeData: [edge] }, onEdgeHover, onTipHover,
    }));
    act(() => result.current.layers[0].props.onHover({ sourceLayer: { id: 'main-trees-edges' }, index: 0 }));
    expect(onEdgeHover).toHaveBeenLastCalledWith(edge, expect.anything(), undefined);
    act(() => result.current.layers[0].props.onHover({ sourceLayer: { id: 'main-trees-tips-pickable' }, object: tip }));
    expect(onEdgeHover).toHaveBeenLastCalledWith(null, expect.anything(), undefined);
    expect(onTipHover).toHaveBeenLastCalledWith(tip, expect.anything(), undefined);
  });
  it('clears a tip tooltip when moving directly to an edge', () => {
    const onTipHover = vi.fn();
    const onEdgeHover = vi.fn();
    const { result } = renderHook(() => useDeckLayers({
      enabledViews: ['ortho'], renderData: { edgeData: [{ tree_idx: 0 }] }, onTipHover, onEdgeHover,
    }));
    act(() => result.current.layers[0].props.onHover({ sourceLayer: { id: 'main-trees-edges' }, index: 0 }));
    expect(onTipHover).toHaveBeenLastCalledWith(null, expect.anything(), undefined);
  });
});
