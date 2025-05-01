import {
  LineLayer,
  ScatterplotLayer,
  TextLayer,
  PathLayer,
  IconLayer
} from "@deck.gl/layers";
import {COORDINATE_SYSTEM} from "@deck.gl/core";
import { Matrix4, } from '@math.gl/core';
import { kn_parse } from "../jstree";

import { useMemo, useCallback, useEffect } from "react";
import useTreenomeLayers from "./useTreenomeLayers";
import getSVGfunction from "../utils/deckglToSvg";

const useLayers = ({
  data,
  search,
  viewState,
  colorHook,
  setHoverInfo,
  hoverInfo,
  colorBy,
  xType,
  modelMatrix,
  selectedDetails,
  xzoom,
  settings,
  // isCurrentlyOutsideBounds,
  config,
  treenomeState,
  treenomeReferenceInfo,
  setTreenomeReferenceInfo,
  hoveredKey,
}) => {
  
  // let minX = Infinity;
  // let maxX = -Infinity;

  var layers = [];
  if((data.data) && (data.data.paths)) {



    layers = data.data.paths.flatMap((tree, i) => {


      const mutation_filteredData = tree.filter(d => 'mutations' in d);

      const zoomScale = 1 / Math.pow(2, viewState.zoom);
      const verticalOffset = i * (1.2); 
      const modelMatrix = new Matrix4().translate([0, verticalOffset , 0]); // stack vertically
      const genome_position = data.data.genome_positions[i];
      let path_layer = new PathLayer({
        id: `main-layer-${i}`,
        data: tree.filter(d => d.path),
        getPath: d => d.path,
        getColor: () => [255, 80, 200],
        getWidth: 2,
        modelMatrix,
        pickable:false,
        widthUnits: 'pixels',
        zOffset: 0.1,
        viewId: 'ortho'
      })

      let nodes_layer = new ScatterplotLayer({
        id: `main-dots-${i}`,
        data: tree.filter(d => d.position),
        getPosition: d => d.position,
        getFillColor: [80, 80, 180],
        getRadius: 4,
        modelMatrix,
        radiusUnits: 'pixels',
        pickable: false,
        zOffset: 0.1,
        viewId: 'ortho'
      });

      const lineLayer = new LineLayer({
        id: `genome-positions-line-${i}`,
        data: [{sourcePosition: [0, 0], targetPosition: [0, 1]}], // normalized
        getSourcePosition: d => d.sourcePosition,
        getTargetPosition: d => d.targetPosition,
        getColor: [0, 0, 255],
        getWidth: 4,
        widthUnits: 'pixels',
        modelMatrix,
        viewId: 'genome-positions'
      });

      var topLabelLayer = null
      var bottomLabelLayer = null;
      if(i===0){
        topLabelLayer = new TextLayer({
          id: `genome-positions-top-label-${i}`,
          data: [{
            position: [0, -0.01], // small offset above
            text: String(genome_position.start)
          }],
          getPosition: d => d.position,
          getText: d => d.text,
          getColor: [0, 0, 0],
          getSize: 10,
          sizeUnits: 'pixels',
          getAlignmentBaseline: 'bottom',
          modelMatrix,
          viewId: 'genome-positions'
        });
      }
      
        bottomLabelLayer = new TextLayer({
          id: `genome-positions-bottom-label-${i}`,
          data: [{
            position: [0, 1 + 0.15], // small offset above
            text: String(genome_position.end)
          }],
          getPosition: d => d.position,
          getText: d => d.text,
          getColor: [0, 0, 0],
          getSize: 10,
          sizeUnits: 'pixels',
          getAlignmentBaseline: 'bottom',
          modelMatrix,
          viewId: 'genome-positions'
        });

        const mutationLayer = new IconLayer({
          id: `main-mutations-marker-${i}`,
          data: mutation_filteredData,
          // data: [{
          //   position:[0.5,0.5],
          //   name: 'marker'
          // }],
          getPosition: d=> d.position,
          getIcon:d=>'marker',
          getSize:10,
          sizeScale: 3,
          iconAtlas: '/close.png',
          iconMapping:{
            marker: { x: 0, y: 0, width: 128, height: 128, anchorY: 128 }
          },
          modelMatrix,
        pickable:true,
        viewId: 'ortho',
        getColor: [255, 0, 0]
      })

      return [path_layer, nodes_layer, mutationLayer, lineLayer, topLabelLayer, bottomLabelLayer]
  })
}

// Add the x-axis line separately outside the loop


// layers.push(lineLayer)


// const layerFilter = useCallback(
//   ({ layer, viewport, renderPass }) => {
//     const first_bit = (layer.id.startsWith("main") && viewport.id === "main") 
//     return first_bit;
//   },
//   []
// );

  const layerFilter = useCallback(({ layer, viewport }) => {
    const isortho = viewport.id === 'ortho';
    const isXaxis = viewport.id === 'genome-positions';
  
    return (
      (isortho && layer.id.startsWith('main')) ||
      (isXaxis && layer.id.startsWith('genome-positions'))
    )},[]);


  
  // console.log("layers", layers)
  return { layers: layers,layerFilter};
};

export default useLayers;
