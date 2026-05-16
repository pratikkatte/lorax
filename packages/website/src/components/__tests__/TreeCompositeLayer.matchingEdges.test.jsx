import { describe, expect, it, vi } from 'vitest';

vi.mock('@deck.gl/core', () => ({
  COORDINATE_SYSTEM: { CARTESIAN: 'cartesian' },
  CompositeLayer: class {
    constructor(props = {}) {
      this.props = {
        ...(this.constructor.defaultProps || {}),
        ...props
      };
      this.state = {};
    }

    setState(nextState) {
      this.state = {
        ...this.state,
        ...nextState
      };
    }
  }
}));

vi.mock('@deck.gl/layers', () => {
  class MockLayer {
    constructor(props) {
      this.props = props;
      this.id = props.id;
    }
  }

  return {
    IconLayer: MockLayer,
    PathLayer: MockLayer,
    ScatterplotLayer: MockLayer
  };
});

import { TreeCompositeLayer } from '@lorax/core/src/layers/TreeCompositeLayer.jsx';

describe('TreeCompositeLayer matching edge overlay', () => {
  it('uses the base edge color for matching edge highlights', () => {
    const edgeColor = [10, 20, 30, 255];
    const layer = new TreeCompositeLayer({
      id: 'test-trees',
      edgeColor,
      renderData: {
        pathPositions: new Float64Array([
          0, 0, 1, 0, 1, 1,
          2, 0, 3, 0, 3, 1
        ]),
        pathStartIndices: new Uint32Array([0, 3, 6]),
        edgeData: [
          { tree_idx: 0, parent_id: 1, child_id: 2 },
          { tree_idx: 1, parent_id: 1, child_id: 2 }
        ],
        edgeCount: 2,
        tipPositions: new Float64Array(0),
        tipColors: new Uint8Array(0),
        tipCount: 0,
        matchingEdgeIndices: [1]
      }
    });

    layer.updateState({ props: layer.props, oldProps: {} });
    const layers = layer.renderLayers();
    const matchingLayer = layers.find((item) => item.id === 'test-trees-matching-edges');

    expect(matchingLayer.props.getColor).toBe(edgeColor);
  });
});
