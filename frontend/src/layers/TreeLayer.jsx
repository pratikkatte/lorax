
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

    return [
      new PathLayer({
        id: `${this.props.id}-path-${bin.global_index}`,
        data: bin.path,
        getPath: d => d.path,
        getColor: d =>
          hoveredTreeIndex && d.path === hoveredTreeIndex.path
            ? [0, 0, 0, 255]
            : [150, 150, 150, 255],
        getWidth: d =>
          hoveredTreeIndex && d.path === hoveredTreeIndex.path ? 3 : 2,
        widthUnits: 'pixels',
        viewId,
        modelMatrix:bin.modelMatrix,
        pickable: true,
        zOffset: -1,
        updateTriggers: {
          getWidth: [hoveredTreeIndex],
          getColor: [hoveredTreeIndex],
          data: [bin.path, bin.modelMatrix],
        },
      }),

      new ScatterplotLayer({
        id: `${this.props.id}-smaples-${bin.global_index}`,
        data: bin.path.filter(d => 
          d?.position !== undefined && 
          d?.position !== null && 
          d?.mutations === undefined
        ),
        getPosition: d => d.position,
        getFillColor: [10, 10, 10, 255],
        getLineColor: [80, 80, 180, 255],
        getLineWidth: 1,
        getRadius: 0.005,
        // radiusUnits: 'pixels',
        radiusUnits: 'common',
        modelMatrix:bin.modelMatrix,
        viewId,
        updateTriggers: {
          data: [bin.path, bin.modelMatrix],
        },
      }),

      new IconLayer({
        id: `${this.props.id}-icons-${bin.global_index}`,
        data: bin.path.filter(d => d?.mutations !== undefined && d?.mutations !== null),
        getPosition: d => d.position,
        getIcon: () => 'marker',
        modelMatrix:bin.modelMatrix,
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
          data: [bin.path, bin.modelMatrix],
        },
      }),
    ];
  }
}
