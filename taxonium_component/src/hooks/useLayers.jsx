import {
  LineLayer,
  ScatterplotLayer,
  PolygonLayer,
  TextLayer,
  SolidPolygonLayer,
  PathLayer
} from "@deck.gl/layers";
import {COORDINATE_SYSTEM} from "@deck.gl/core";
import { Matrix4, } from '@math.gl/core';
import { kn_parse } from "../jstree";

import { useMemo, useCallback, useEffect } from "react";
import useTreenomeLayers from "./useTreenomeLayers";
import getSVGfunction from "../utils/deckglToSvg";


function layoutTree(node, yOffset = { value: 0 }, x = 0) {
  node.x = x;
node.mutation = ''
  if (!node.d) node.d = 0;

  if (!node.child || node.child.length === 0) {
    node.y = yOffset.value++;
  } else {
    node.child.forEach(c =>
      layoutTree(c, yOffset, x + c.d)
    );
    node.y = node.child.reduce((sum, c) => sum + c.y, 0) / node.child.length;
  }
}

function extractSquarePaths(node) {
  const segments = [];

  if (node.child.length>0) {
    node.child.forEach(child => {
      // Horizontal segment from parent to child x at parent y

      // Vertical drop to child's y
      segments.push({
        path: [
          [node.x, node.y],
          [node.x, child.y]
        ],
      });

      segments.push({
        path: [
          [node.x, child.y],
          [child.x, child.y]
        ]
      });


      // Recurse into children
      segments.push(...extractSquarePaths(child));
    });
  } else {
    segments.push({
      position: [node.x, node.y],
    })
  }

  return segments;
}



const getKeyStuff = (getNodeColorField, colorByField, dataset, toRGB) => {
  const counts = {};
  for (const node of dataset.nodes) {
    const value = getNodeColorField(node, dataset);
    if (value in counts) {
      counts[value]++;
    } else {
      counts[value] = 1;
    }
  }
  const keys = Object.keys(counts);
  const output = [];
  for (const key of keys) {
    output.push({ value: key, count: counts[key], color: toRGB(key) });
  }
  return output;
};

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

      const zoomScale = 1 / Math.pow(2, viewState.zoom);
      const verticalOffset = i * (1.2); 
      const modelMatrix = new Matrix4().translate([0, verticalOffset , 0]); // stack vertically

      // tree.forEach(d => {
      //   if (d.path) {
      //     d.path.forEach(point => {
      //       if (point[0] < minX) minX = point[0];
      //       if (point[0] > maxX) maxX = point[0];
      //     });
      //   }
      // });  
      // console.log("tree", tree)
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
      
      


      return [path_layer, nodes_layer, lineLayer, topLabelLayer, bottomLabelLayer]
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



  
  return { layers: layers,layerFilter};
};

export default useLayers;
