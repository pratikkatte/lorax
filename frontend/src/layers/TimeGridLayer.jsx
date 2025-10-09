import {CompositeLayer} from '@deck.gl/core';
import {TextLayer} from '@deck.gl/layers';
import { Matrix4 } from "@math.gl/core";
import {CollisionFilterExtension} from '@deck.gl/extensions';
import {DataFilterExtension} from '@deck.gl/extensions';



export class TimeGridLayer extends CompositeLayer {
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
    return [
      new TextLayer({
        id: `${this.props.id}-labels`,
        data,
        // extensions: [new CollisionFilterExtension()],
        getPosition: d => [0.5, d.position],
        getText: d => d.text.toString(),
        getColor: [0,0,0,255],
        sizeUnits: 'pixels',
        getSize: 12,
        getAlignmentBaseline: 'center',
        getTextAnchor: 'middle',
        viewId,
        pickable: false,
        modelMatrix,
        zOffset: -1,
        // extensions: [new CollisionFilterExtension()],
        // collisionEnabled: true, 
        // background: true,  
        // getCollisionPriority: d => d.priority || 0,
        // getFilterValue: f => f.position,
        // filterRange: [0,1]
      })
    ];
  }
}
