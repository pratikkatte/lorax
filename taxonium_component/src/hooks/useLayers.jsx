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

      let path_layer = new PathLayer({
        id: `main-layer-${i}`,
        data: tree.filter(d => d.path),
        getPath: d => d.path,
        getColor: () => [255, 80, 200],
        getWidth: 2,
        modelMatrix,
        pickable:false,
        widthUnits: 'pixels',
        // zOffset: 0.1,
        // viewId: 'ortho'
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
        // viewId: 'ortho'
      });

      const genomicX = -0.5 // normalize to [0, 1]
      const genomic_position_layer = new LineLayer({
        id: `genome-position-line-${i}`,
        data: [
          { source: [genomicX, 0], target: [genomicX, 1] }
        ],
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: [255, 0, 0],
        getWidth: 2,
        modelMatrix,
        pickable: false,
        // viewId: 'scalesY'
      });

      return [path_layer, nodes_layer]
  })
}

// Add the x-axis line separately outside the loop

if(data.data && data.data.paths){


const xAxisLineLayer = new LineLayer({
  id: 'x-axis-line',
  data: [
    { source: [1, 1], target: [2, 1] } // Create a line from -1 to 1 horizontally at y = -1
  ],
  getSourcePosition: d => d.source,
  getTargetPosition: d => d.target,
  getColor: [0, 255, 0], // Green color for x-axis
  getWidth: 2,
  // Fix the x-axis line to stay at the bottom of the screen
  modelMatrix: new Matrix4().translate([0, data.data.paths.length, 0]), // Position it at y = -1 in screen space
  // pickable: false,
  // coordinateSystem: COORDINATE_SYSTEM.IDENTITY, // Ensure it's in screen space
  viewId: 'scalesX'
});


// layers.push(xAxisLineLayer)
}

const layerFilter = useCallback(
  ({ layer, viewport, renderPass }) => {
    const first_bit = (layer.id.startsWith("main") && viewport.id === "main") 
    return first_bit;
  },
  []
);


    

  return { layers: layers,layerFilter};
};

export default useLayers;
