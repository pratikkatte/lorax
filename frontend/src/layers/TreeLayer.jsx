
// TreeLayer.js
import { CompositeLayer } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer, IconLayer, TextLayer } from '@deck.gl/layers';

export default class TreeLayer extends CompositeLayer {
  static defaultProps = {
    bin: null,
    globalBpPerUnit: 1,
    hoveredTreeIndex: null,
    treeSpacing: 1.03,
    viewId: 'ortho',
    hoveredTreeIndex: null,
    populations: null,
    populationFilter: null,
  };


  renderLayers() {
    const id_populations = this.props.populations.populations;
    const nodes_population = this.props.populations.nodes_population;

    const { bin, viewId, hoveredTreeIndex, populationFilter } = this.props;
    if (!bin || !bin.path) return null

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
        getFillColor: d => { 
          const sample_population = nodes_population[parseInt(d.name)];

          if (populationFilter.enabledValues.includes(sample_population)) {
            return id_populations[sample_population].color
          } else {
            return [200, 200, 200, 100]
          }
          
        },
        getLineColor: [80, 80, 180, 255],
        getLineWidth: 1,
        getRadius: 3,
        // radiusUnits: 'pixels',
        radiusUnits: 'pixels',
        // modelMatrix:bin.modelMatrix,
        pickable: true,
        modelMatrix:bin.modelMatrix,
        viewId,
        updateTriggers: {
          getFillColor: [populationFilter.colorBy, populationFilter.enabledValues],
          data: [bin.path, bin.modelMatrix],
        },
      }),

      new IconLayer({
        id: `${this.props.id}-icons-${bin.global_index}`,
        data: bin.path.filter(d => d?.mutations !== undefined && d?.mutations !== null),
        getPosition: d => d.position,
        getIcon: () => 'marker',
        // modelMatrix:bin.modelMatrix,
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



// import { CompositeLayer } from '@deck.gl/core';
// import { PathLayer, ScatterplotLayer, IconLayer } from '@deck.gl/layers';

// export default class TreeLayer extends CompositeLayer {
//   static defaultProps = {
//     bins: {},
//     viewId: 'ortho',
//     hoveredTreeIndex: null,
//     setHoveredTreeIndex: null,
//     globalBpPerUnit: 1,
//     treeSpacing: 1.03,
//   };

  

//   renderLayers() {
//     const transformPoint = (point, matrix) => {
//       const [x, y] = point;
//       const z = 0; 
      
//       // Matrix multiplication of [x, y, z, 1] by the 4x4 matrix
//       const newX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * 1;
//       const newY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * 1;
      
//       return [newX, newY];

//     }

//     const { bins, viewId, hoveredTreeIndex } = this.props;
//     if (!bins || Object.keys(bins).length === 0) return null;

//     // --- Flatten all bins into single arrays for batching ---
//     const visibleBins = Object.values(bins).filter(b => b?.visible && b?.path);

//     const pathData = [];
//     const sampleData = [];
//     const mutationData = [];

//     for (const bin of visibleBins) {
//       const { modelMatrix, global_index } = bin;

//       const matrixArray = modelMatrix?.toArray ? modelMatrix.toArray() : modelMatrix;

//       for (const d of bin.path) {
//         // Each 'd' = {path, position?, mutations?}
//         if (d.path) {
//           const transformedPath = d.path.map(p => transformPoint(p, matrixArray));
//           pathData.push({
//             ...d,
//             global_index,
//             modelMatrix: matrixArray,
//           });
//         }

//         if (d?.position && d?.mutations === undefined) {
//           sampleData.push({
//             ...d,
//             modelMatrix,
//             global_index,
//           });
//         }

//         if (d?.position && d?.mutations !== undefined) {
//           mutationData.push({
//             ...d,
//             modelMatrix,
//             global_index,
//           });
//         }
//       }
//     }

//     // --- Shared update triggers for efficiency ---
//     const triggers = {
//       hovered: [hoveredTreeIndex],
//       data: [bins],
//     };

//     // --- Combined PathLayer ---
//     const pathLayer = new PathLayer({
//       id: `${this.props.id}-batched-paths`,
//       data: pathData,
//       getPath: d => {
//         const transformedPath = d.path.map(p => transformPoint(p, d.modelMatrix));
//         return transformedPath
//       },
//       getColor: d =>
//         hoveredTreeIndex && d.global_index === hoveredTreeIndex.global_index
//           ? [0, 0, 0, 255]
//           : [150, 150, 150, 255],
//       getWidth: d =>
//         hoveredTreeIndex && d.global_index === hoveredTreeIndex.global_index
//           ? 3
//           : 2,
//       widthUnits: 'pixels',
//       // modelMatrix: d.modelMatrix,
//       viewId,
//       pickable: true,
//       zOffset: 0,
//       updateTriggers: {
//         getColor: triggers.hovered,
//         getWidth: triggers.hovered,
//         // getModelMatrix: triggers.data,
//       },
//     });

//     // --- Combined ScatterplotLayer (samples) ---
//     // const sampleLayer = new ScatterplotLayer({
//     //   id: `${this.props.id}-batched-samples`,
//     //   data: sampleData,
//     //   getPosition: d => d.position,
//     //   getFillColor: [10, 10, 10, 255],
//     //   getRadius: 0.005,
//     //   radiusUnits: 'common',
//     //   getModelMatrix: d => d.modelMatrix,
//     //   viewId,
//     //   updateTriggers: {
//     //     getModelMatrix: triggers.data,
//     //   },
//     // });

//     // // --- Combined IconLayer (mutations) ---
//     // const iconLayer = new IconLayer({
//     //   id: `${this.props.id}-batched-icons`,
//     //   data: mutationData,
//     //   getPosition: d => d.position,
//     //   getIcon: () => 'marker',
//     //   getColor: [255, 0, 0],
//     //   getSize: 0.01,
//     //   sizeUnits: 'common',
//     //   iconAtlas: '/X.png',
//     //   iconMapping: {
//     //     marker: { x: 0, y: 0, width: 128, height: 128, mask: true },
//     //   },
//     //   getModelMatrix: d => d.modelMatrix,
//     //   viewId,
//     //   updateTriggers: {
//     //     getModelMatrix: triggers.data,
//     //   },
//     // });

//     return [pathLayer];
//     // return [pathLayer, sampleLayer, iconLayer];
//   }
// }
