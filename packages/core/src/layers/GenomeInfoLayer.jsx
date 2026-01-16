import { CompositeLayer } from '@deck.gl/core';
import { LineLayer } from '@deck.gl/layers';

/**
 * GenomeInfoLayer - Renders tree interval markers for genome info view
 */
export class GenomeInfoLayer extends CompositeLayer {
  static layerName = 'GenomeInfoLayer';
  static defaultProps = {
    data: [],
    y0: 0,
    y1: 2,
    labelOffset: 0.05,
    getColor: [100, 100, 100, 100],
    getTextColor: [60, 60, 60, 255],
    getText: d => `${d.start}`,
    showLabels: true,
    viewId: null,
    backend: null,
    globalBpPerUnit: null,
    xzoom: null,
    filterRange: null,
    hoveredGenomeInfo: null,
  };

  renderLayers() {
    const {
      data, y0, y1,
      getColor, viewId, globalBpPerUnit
    } = this.props;

    // Handle various data formats
    let binArray = [];
    if (data instanceof Map) {
      binArray = Array.from(data.values());
    } else if (Array.isArray(data)) {
      binArray = data;
    } else if (data && typeof data === "object") {
      binArray = Object.values(data);
    } else {
      return [];
    }

    if (binArray.length === 0) return [];

    return [
      new LineLayer({
        id: `${this.props.id}-lines`,
        data: Array.from(data.values()).map(d => d.s),
        getSourcePosition: d => [d / globalBpPerUnit, y0],
        getTargetPosition: d => [d / globalBpPerUnit, y1],
        getColor,
        viewId,
        pickable: false,
        zOffset: -1,
      })
    ].filter(Boolean);
  }
}
