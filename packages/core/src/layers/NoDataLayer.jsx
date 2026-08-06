import { CompositeLayer } from '@deck.gl/core';
import { LineLayer } from '@deck.gl/layers';

/** A subtle, non-pickable hatch for genomic regions with no observed tree. */
export class NoDataLayer extends CompositeLayer {
  static layerName = 'NoDataLayer';
  static defaultProps = { data: [], globalBpPerUnit: null, viewId: null, y0: 0, y1: 2 };

  renderLayers() {
    const { data, globalBpPerUnit, viewId, y0, y1 } = this.props;
    if (!Array.isArray(data) || data.length === 0 || !globalBpPerUnit) return [];
    const lines = data.flatMap(([left, right]) => {
      const width = right - left;
      if (!(width > 0)) return [];
      return [0.1, 0.35, 0.6, 0.85].map(offset => ({
        source: [(left + width * Math.max(0, offset - 0.16)) / globalBpPerUnit, y0],
        target: [(left + width * Math.min(1, offset + 0.16)) / globalBpPerUnit, y1],
      }));
    });
    return new LineLayer({
      id: `${this.props.id}-hatch`, data: lines,
      getSourcePosition: d => d.source, getTargetPosition: d => d.target,
      getColor: [115, 115, 115, 75], getWidth: 1, widthUnits: 'pixels',
      viewId, pickable: false,
    });
  }
}
