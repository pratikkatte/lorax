// // TreeLayer.jsx
// import { CompositeLayer } from '@deck.gl/core';
// import { PathLayer } from '@deck.gl/layers';

// export default class TreeLayer extends CompositeLayer {
//   static layerName = 'TreeLayer';

//   static defaultProps = {
//     data: [],
//     getPath: d => d.path,        // accessor for path coordinates
//     getColor: d => [0, 0, 0, 255],
//     getWidth: 2,
//     pickable: true,
//     parameters: {}
//   };

//   renderLayers() {
//     const { data, getPath, getColor, getWidth, pickable, parameters } = this.props;

//     return new PathLayer({
//       id: `${this.props.id || 'tree'}-path-layer`,
//       data,
//       getPath,
//       getColor,
//       getWidth,
//       pickable,
//       parameters
//     });
//   }
// }


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

    return [
      // Path layer for the tree
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
      })
    ];
  }
}
