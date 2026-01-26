import { CompositeLayer } from '@deck.gl/core';
import { TextLayer } from '@deck.gl/layers';
import { Matrix4 } from "@math.gl/core";

/**
 * TimeGridLayer - Renders time axis labels for tree-time view
 */
export class TimeGridLayer extends CompositeLayer {
  static layerName = 'TimeGridLayer';
  static defaultProps = {
    data: [],
    y0: 0,
    y1: 2,
    labelOffset: 0.05,
    getColor: [100, 100, 100, 100],
    getTextColor: [60, 60, 60, 255],
    getText: d => `${d.start}`,
    showLabels: true,
    modelMatrix: null,
    viewId: null,
    backend: null,
    globalBpPerUnit: null,
    xzoom: null
  };

  renderLayers() {
    const { data, viewId } = this.props;

    if (!Array.isArray(data) || data.length === 0) return [];

    const treeSpacing = 0;
    const modelMatrix = new Matrix4().translate([treeSpacing, 0, 0]);

    return [
      new TextLayer({
        id: `${this.props.id}-labels`,
        data,
        getPosition: d => [0.5, d.y],
        getText: d => d.text,
        getColor: [0, 0, 0, 255],
        sizeUnits: 'pixels',
        getSize: 12,
        getAlignmentBaseline: 'center',
        getTextAnchor: 'middle',
        viewId,
        pickable: false,
        modelMatrix,
        zOffset: -1,
      })
    ];
  }
}
