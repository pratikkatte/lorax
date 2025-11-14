import {CompositeLayer} from '@deck.gl/core';
import {LineLayer, PolygonLayer} from '@deck.gl/layers';


export class GenomeInfoLayer extends CompositeLayer {
  static defaultProps = {
    data: [],
    y0: 0,
    y1: 2,
    labelOffset: 0.05,             // offset above the line (in view coords)
    getColor: [100, 100, 100, 100],
    getTextColor: [60, 60, 60, 255],
    getText: d => `${d.start}`,     // label content
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
      getColor, viewId, globalBpPerUnit, hoveredGenomeInfo
    } = this.props;

    let binArray = [];

    if (data instanceof Map) {
      binArray = Array.from(data.values());
    } else if (Array.isArray(data)) {
      binArray = data;
    } else if (data && typeof data === "object") {
      binArray = Object.values(data);
    } else {
      // Unknown format — skip rendering
      return [];
    }

    if (binArray.length === 0) return [];


    const visbile_data = Array.from(data.values()).filter(d => d.visible).map(b => ({"s": b.position,"global_index":b.global_index, "e": (b.position + b.span)}));

    return [
      new LineLayer({
      id: `${this.props.id}-lines`,
      data:Array.from(data.values()).map(d => d.s),
      getSourcePosition: d => [d / globalBpPerUnit, y0],
      getTargetPosition: d => [d /globalBpPerUnit, y1],
      getColor,
      viewId,
      pickable: false,
      zOffset: -1,
    }),

    new PolygonLayer({
      id: `${this.props.id}-polygons`,
      data: visbile_data,
      getPolygon: d => [[d.s/globalBpPerUnit, y0], [d.e/globalBpPerUnit, y0], [d.e/globalBpPerUnit, y1], [d.s/globalBpPerUnit, y1]],
      getFillColor: d => hoveredGenomeInfo === d.global_index ? [0, 0, 0, 80] : [255, 255, 255,50],
      getLineColor: [255, 255, 255,0],
      viewId,
      pickable: true,
      zOffset: 5,
      updateTriggers: {
        getFillColor: [hoveredGenomeInfo],
      },
    })
  ].filter(Boolean);  
}
}
