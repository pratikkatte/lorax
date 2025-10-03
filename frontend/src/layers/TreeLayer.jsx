
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

    const divide_pos = bin.position / globalBpPerUnit;
    const modelMatrix = new Matrix4().translate([treeSpacing+bin.padding, 0, 0]);

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
        data: bin.path.filter(d => 
          d?.position !== undefined && 
          d?.position !== null && 
          d?.mutations === undefined
        ),
        getPosition: (d) => {
          const pos = d.position[0] + divide_pos;
          return [pos, d.position[1]];
        },
        getFillColor: [10, 10, 10, 255],
        getLineColor: [80, 80, 180, 255],
        getLineWidth: 1,
        getRadius: 0.005,
        // radiusUnits: 'pixels',
        radiusUnits: 'common',
        modelMatrix,
        viewId,
      }),

      new IconLayer({
        id: `${this.props.id}-icons-${bin.global_index}`,
        data: bin.path.filter(d => d?.mutations !== undefined && d?.mutations !== null),
        getPosition: (d) => [d.position[0] + divide_pos, d.position[1]],
        getIcon: () => 'marker',
        modelMatrix,
        getColor: [255, 0, 0],
        viewId,
        getSize: 0.01,     
        sizeUnits: 'common',
        // sizeScale: 1,    
        iconAtlas: '/X.png',
        iconMapping: {
          marker: {x: 0, y: 0, width: 128, height: 128, mask: true}
        },
        updateTriggers: {
          data: [bin.path],
        },
      }),
    ];
  }
}
