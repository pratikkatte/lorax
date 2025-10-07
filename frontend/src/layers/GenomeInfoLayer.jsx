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
    modelMatrix: null,
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

    const treeSpacing = 0;
    const modelMatrix = new Matrix4().translate([treeSpacing, 0, 0]);
    // const modelMatrix = null;'

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
      modelMatrix,
      zOffset: -1,
    }),
    // new TextLayer({
    //     id: `${this.props.id}-skip-labels`,
    //     data: Object.values(data).map(d => ({skip_position: (d.s+(d.span/2))/globalBpPerUnit, skip_count: d.skip_count? d.skip_count : 0})),
    //     getPosition: d => [d.skip_position, 1],
    //     getText: d => d.skip_count > 0 ? `${d.skip_count} skip trees` : '',
    //     getColor: [0,10,0,255],
    //     sizeUnits: 'pixels',
    //     getSize: 12,
    //     viewId,
    //     pickable: false,
    //     modelMatrix,
    //     updateTriggers: {
    //     },
    //     zIndex: 1000,
    //     // zOffset: -1,

    //   })
    ].filter(Boolean);  }
}
