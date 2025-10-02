
// TreeLayer.js
import { CompositeLayer } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer, IconLayer } from '@deck.gl/layers';
import { Matrix4 } from '@math.gl/core';

export default class TreeLayer extends CompositeLayer {
  static defaultProps = {
    bin: null,
    globalBpPerUnit: 1,
    hoveredTreeIndex: null,
    treeSpacing: 1.03,
    viewId: 'ortho',
  };

  renderLayers() {
    const { bin, globalBpPerUnit, hoveredTreeIndex, treeSpacing, viewId } = this.props;
    if (!bin || !bin.path) return null;

    const divide_pos = bin.s / globalBpPerUnit;
    const modelMatrix = new Matrix4().translate([treeSpacing, 0, 0]);
    console.log("bin", bin.path.filter(d => d?.position !== undefined && d?.position !== null));
    return [
      new PathLayer({
        id: `${this.props.id}-path-${bin.global_index}`,
        data: bin.path,
        getPath: d => d?.path?.map(([x, y]) => [x + divide_pos, y]),
        getColor: d =>
          hoveredTreeIndex && d.path === hoveredTreeIndex.path
            ? [0, 0, 0, 255]
            : [150, 150, 150, 255],
        getWidth: d =>
          hoveredTreeIndex && d.path === hoveredTreeIndex.path ? 3 : 2,
        widthUnits: 'pixels',
        viewId,
        modelMatrix,
        pickable: true,
        zOffset: -1,
        updateTriggers: {
          getWidth: [hoveredTreeIndex],
          data: [bin.path],
        },
      }),

      new ScatterplotLayer({
        id: `${this.props.id}-smaples-${bin.global_index}`,
        data: bin.path.filter(d => d?.position !== undefined && d?.position !== null),
        getPosition: (d) => {
          const pos = d.position[0] + divide_pos;
          return [pos, d.position[1]];
        },
        getFillColor: [100, 200, 100, 255],
        getLineColor: [80, 80, 180, 255],
        getLineWidth: 1,
        getRadius: 3,
        radiusUnits: 'pixels',
        modelMatrix,
        viewId,
      }),

    ];
  }
}
