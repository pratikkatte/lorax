import {CompositeLayer} from '@deck.gl/core';
import {LineLayer, TextLayer} from '@deck.gl/layers';
import { Matrix4 } from "@math.gl/core";

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
    globalBins: [],
    backend: null,
    globalBpPerUnit: null,
    xzoom: null
  };

  renderLayers() {
    
    const {
      data, y0, y1,
      getColor, viewId, showLabels, globalBpPerUnit
    } = this.props;

    if (!Object.keys(data).length) return [];

    return [
      new LineLayer({
      id: `${this.props.id}-lines`,
      data: Object.values(data).map(d => d.s),
      getSourcePosition: d => {
        
        const pos = [d / globalBpPerUnit, y0];
        return pos;
      },
      getTargetPosition: d => [d /globalBpPerUnit, y1],
      getColor,
      viewId,
      pickable: false,
      zOffset: -1,
    }),
    new TextLayer({
      id: `${this.props.id}-labels`,
      data: Object.values(data).map(d => ({global_index: d.global_index, position: d.s})),
      getPosition: d => [d.position/globalBpPerUnit, 1],
      getText: d => d.global_index,
      getColor: [0,0,0,255],
      sizeUnits: 'pixels',
      getSize: 12,
      viewId,
      pickable: false,
      updateTriggers: {
        data: [data],
        getPosition: [globalBpPerUnit],
        getText: [data],
      },
      zIndex: 1000,
      zOffset: -1,
    })
    ].filter(Boolean);  }
}
