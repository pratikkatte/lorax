import {CompositeLayer} from '@deck.gl/core';
import {LineLayer, TextLayer} from '@deck.gl/layers';
import memoizeOne from 'memoize-one';
import { Matrix4, Vector3 } from "@math.gl/core";

export class GenomeGridLayer extends CompositeLayer {
  static defaultProps = {
    localCoordinates: [],
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
      getColor, viewId, showLabels, globalBpPerUnit, localCoordinates
    } = this.props;

    if (!Object.keys(data).length) return [];

    const treeSpacing = 1.03;
    const modelMatrix = new Matrix4().translate([treeSpacing, 0, 0]);

    return [
    //   new LineLayer({
    //   id: `${this.props.id}-lines`,
    //   data: Object.values(data).map(d => d.s),
    //   getSourcePosition: d => {
    //     const pos = [d / globalBpPerUnit, y0];
    //     return pos;
    //   },
    //   getTargetPosition: d => [d /globalBpPerUnit, y1],
    //   getColor,
    //   viewId,
    //   pickable: false,
    //   modelMatrix,
    //   zOffset: -1,
    // }),
    showLabels &&
      new TextLayer({
        id: `${this.props.id}-labels`,
        data: localCoordinates,
        getPosition: d => [d.x/globalBpPerUnit, 1],
        getText: d => d.text.toLocaleString("en-US", { maximumFractionDigits: 0 }),
        getColor: [0,10,0,255],
        sizeUnits: 'pixels',
        getSize: 12,
        viewId,
        pickable: false,
        modelMatrix,
        updateTriggers: {
          data: localCoordinates,
          getPosition: [globalBpPerUnit],
          getText: [localCoordinates]   
        },
        zOffset: -1,
      }),
      // new TextLayer({
      //   id: `${this.props.id}-skip-labels`,
      //   data: Object.values(data).map(d => ({skip_position: (d.s+(d.span/2))/globalBpPerUnit, skip_count: d.skip_count? d.skip_count : 0})),
      //   getPosition: d => [d.skip_position, 1],
      //   getText: d => d.skip_count > 0 ? `${d.skip_count} skip trees` : '',
      //   getColor: [0,10,0,255],
      //   sizeUnits: 'pixels',
      //   getSize: 12,
      //   viewId,
      //   pickable: false,
      //   modelMatrix,
      //   updateTriggers: {
      //     data: localCoordinates,
      //     getPosition: [globalBpPerUnit],
      //     getText: [localCoordinates]   
      //   },
      //   zIndex: 1000,
      //   // zOffset: -1,

      // })
    ].filter(Boolean);
  }
}
