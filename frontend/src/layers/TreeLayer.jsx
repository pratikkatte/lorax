
// TreeLayer.js
import { CompositeLayer } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import {COORDINATE_SYSTEM} from '@deck.gl/core';
import {GL} from '@luma.gl/constants' // Note the ESM import


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
    if (!bin || !bin.path || !bin.modelMatrix || !bin.visible) return null
    return [
      new PathLayer({
        id: `${this.props.id}-path-${bin.global_index}`,
        data: bin.path,
        getPath: d => { 
          if (!d?.path ) return null;

          const paths = d?.path;
          const m = bin.modelMatrix;
          
          const transformedPath = paths?.map(p => {
            const world = [p[0] * m[0] + m[12] , p[1]];
            return world;
          })
          return transformedPath
        },
        jointRounded: true,
        capRounded: true,
        getColor: d =>
          hoveredTreeIndex && d.path === hoveredTreeIndex.path
            ? [50, 50, 50, 255]             
            : [150, 145, 140, 230],

        getWidth: d =>
          hoveredTreeIndex && d.path === hoveredTreeIndex.path ? 2 : 1.2,
        widthUnits: 'pixels',
        viewId,
        modelMatrix:null,
        pickable: true,
        coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
        zOffset: -1,
        fp64: true,
        updateTriggers: {
          getWidth: [hoveredTreeIndex],
          getColor: [hoveredTreeIndex],
          data: [bin.path, bin.modelMatrix],
          getPath: [bin.modelMatrix, bin.path],
        },
      }),

      new ScatterplotLayer({
        id: `${this.props.id}-smaples-${bin.global_index}`,
        data: bin.path.filter(d => 
          d?.position !== undefined && 
          d?.position !== null && 
          d?.mutations === undefined
        ),
        getPosition: d => {
          const m = bin.modelMatrix;
          const translate_position = m[12];
          const scale_position = m[0];
          const position = [d.position[0] * scale_position + translate_position, d.position[1]];
          return position;
        },
        getFillColor: d => { 
          const sample_population = nodes_population[parseInt(d.name)];
          if (populationFilter.enabledValues.includes(sample_population)) {
            return [...id_populations[sample_population].color.slice(0, 3), 200]
          } else {
            return [150, 150, 150, 100];     
          }
        },
        // getLineColor: [80, 80, 180, 255],
        getLineColor: [120, 120, 120, 120],
        getLineWidth: 0.5,
        getRadius: 2,
        radiusMinPixels: 1.2,
        radiusUnits: 'pixels',
        coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
        pickable: true,
        modelMatrix:null,
        viewId,
        fp64: true,
        updateTriggers: {
          getFillColor: [populationFilter.colorBy, populationFilter.enabledValues],
          data: [bin.modelMatrix, bin.path],
          
        },
      }),

  //     new TextLayer({
  //       id: `${this.props.id}-text-${bin.global_index}`,
  //       data: bin.path.filter(d => 
  //         d?.position !== undefined && 
  //         d?.position !== null && 
  //         d?.mutations === undefined
  //       ),
  //       getPosition: d => {
  //         const m = bin.modelMatrix;
  //         const translate_position = m[12];
  //         const scale_position = m[0];
  //         const position = [d.position[0] * scale_position + translate_position, d.position[1]];
  //         return position;
  //       },
  //       getText: d => d.name,
  //       fontFamily: "'Inter', 'Roboto', 'Arial', sans-serif",
  //       getColor: [20, 20, 20, 255],
  //       getBackgroundColor: [255, 255, 255, 230],
  //       getPixelOffset: [0, 6],
  //       // background: true,
  //       // getBackgroundColor: [255, 255, 255, 220],
  //       backgroundPadding: [4, 2],
  //       // slight drop-shadow for readability
  // shadowColor: [0, 0, 0, 180],
  // shadowBlur: 2,
  //       viewId,
  //       modelMatrix:null,
  //       coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
  //       fp64: true,
  //       updateTriggers: {
  //         data: [bin.modelMatrix, bin.path],
  //       },
  //       sizeUnits: 'pixels',
  //       getSize: 11,
  //       minSize: 8,
  //       getAlignmentBaseline: 'center',
  //       getTextAnchor: 'end',
  //       getAngle: 45,
        
  //     }),
      new IconLayer({
        id: `${this.props.id}-icons-${bin.global_index}`,
        data: bin.path.filter(d => d?.mutations !== undefined && d?.mutations !== null),
        // getPosition: d => d.position,
        getPosition: d => {
          const m = bin.modelMatrix;
          const translate_position = m[12];
          const scale_position = m[0];
          const position = [d.position[0] * scale_position + translate_position, d.position[1]];
          return position;
        },
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