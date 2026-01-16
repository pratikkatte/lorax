import { CompositeLayer } from '@deck.gl/core';
import { LineLayer } from '@deck.gl/layers';

/**
 * GenomeInfoLayer - Renders tree interval markers as vertical lines
 * Data is an array of bp positions (interval start positions)
 */
export class GenomeInfoLayer extends CompositeLayer {
  static layerName = 'GenomeInfoLayer';
  static defaultProps = {
    data: [],
    y0: 0,
    y1: 2,
    getColor: [100, 100, 100, 100],
    viewId: null,
    globalBpPerUnit: null,
  };

  renderLayers() {
    const { data, y0, y1, getColor, viewId, globalBpPerUnit } = this.props;

    if (!Array.isArray(data) || data.length === 0) return [];
    if (!globalBpPerUnit) return [];

    return [
      new LineLayer({
        id: `${this.props.id}-lines`,
        data,
        getSourcePosition: d => [d / globalBpPerUnit, y0],
        getTargetPosition: d => [d / globalBpPerUnit, y1],
        getColor,
        viewId,
        pickable: false,
        zOffset: -1,
      })
    ];
  }
}
