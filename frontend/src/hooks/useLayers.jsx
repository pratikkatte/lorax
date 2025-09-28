import {
  LineLayer,
  ScatterplotLayer,
  TextLayer,
  PathLayer,
  IconLayer,
  SolidPolygonLayer
} from "@deck.gl/layers";
import { Matrix4, Vector3 } from "@math.gl/core";
// import genomeCoordinates from "../layers/genomeCoordinates";
import { useMemo, useCallback, useState, useEffect } from "react";
import { GenomeGridLayer } from "../layers/GenomeGridLayer";



// const getGenomeLinesCached = (() => {
//   const cache = new Map();
//   return (genomePos, zoom) => {
//     const bucketZoom = Math.ceil(zoom); // integer bucket
//     const cacheKey = `${genomePos.start}-${genomePos.end}-${bucketZoom}`;
//     if (cache.has(cacheKey)) {
//       return cache.get(cacheKey);
//     }

//     // const divisions = bucketZoom <= 9 ? 10 : 20
//     const getDivisions = (zoom) =>get {
//       if (zoom <= 8) return 10;
//       return (zoom) * 2;
//     };
//     const divisions = getDivisions(bucketZoom);
//     const stepSize = (genomePos.end - genomePos.start) / divisions;
//     const middle = 5;
//     const lines = [];

//     for (let j = 0; j <= divisions; j++) {
//       const xPosition = j / divisions;
//       const genomicPosition = genomePos.start + (stepSize * j);
//       const positionstatus =
//         j === 0
//           ? "start"
//           : j === divisions
//           ? "end"
//           : j % middle === 0
//           ? "middle"
//           : null;

//       lines.push({
//         sourcePosition: [xPosition, 0],
//         targetPosition: [xPosition, 2],
//         genomicPosition,
//         positionstatus
//       });
//     }

//     cache.set(cacheKey, lines);
//     return lines;
//   };
// })();


const useLayers = ({
  xzoom,
  valueRef,
  hoveredTreeIndex,
  deckRef,
  backend,
  globalBins,
  regions,
globalBpPerUnit  
}) => {

  const {bins, localCoordinates} = regions;

  const data = {};
  
  const layerFilter = useCallback(({ layer, viewport }) => {
    const isOrtho = viewport.id === 'ortho'
    const isGenome = viewport.id === 'genome-positions';
    const isTreeTime = viewport.id === 'tree-time';

    return (
      (isOrtho && layer.id.startsWith('main')) ||
      (isGenome && layer.id.startsWith('genome-positions')) ||
      (isTreeTime && layer.id.startsWith('tree-time'))
    );
  }, []);

  const layers = useMemo(() => {
    // if (!data?.data?.paths) return [];

    const times = data?.data?.times || {};
// console.log("uselayers bins", bins, globalBins)
    const genomeGridLayer = new GenomeGridLayer({
      backend: backend,
      value: valueRef.current,
      xzoom: xzoom,
      localCoordinates: localCoordinates,
      id: 'genome-positions-grid',
      data: bins,
      globalBpPerUnit: globalBpPerUnit,
      globalBins: globalBins,
      y0: 0,
      y1: 2,
      labelOffset: 0.06,
      getColor: [100, 100, 100, 255],
      getTextColor: [0, 0,0, 255],
      getText: d => d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      modelMatrix: new Matrix4().translate([0, 0, 0]),
      viewId: 'genome-positions',
      showLabels: true,
    });

    // const singleTreeHighlightLayer = bins && bins.length > 0 ? new TextLayer({
    //   id: `main-layer-highlight`,
    //   data: (() => {
    //     const result = [];
    //     for (let i = 0; i < trees.length; i++) {
    //       const globalBin = globalBins[trees[i].global_index];
    //       result.push({
    //         position: [trees[i].position/globalBpPerUnit, 0.5],
    //         text: `${globalBin.acc.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    //         step: trees[i].index,
    //         global_index: trees[i].global_index,
    //       })  
    //     }
    //       return result;
    //   })(),
    //   visible: false,
    //   getPosition: d => d.position,
    //   getText: d => d.text,
    //   sizeUnits: 'pixels',
    //   getColor: [0, 0, 0, 255],
    //   getSize: 10,
    //   highlightColor: [0, 100, 100, 255],
    //   getTextAnchor: 'middle',
    //   getAlignmentBaseline: 'bottom',
    //   updateTriggers: {
    //     data: [bins]
    //   }
    // }) : null;
            

    // const [validBins, setValidBins] = useState([]);
    // useEffect(() => {

    //   setValidBins(Array.isArray(bins) ? bins.filter(d => Array.isArray(d.path) && d.path.length >= 2) : []);

    // }, [bins]);


    // const validBins = Array.isArray(bins) ? bins.filter(d => Array.isArray(d.path) && d.path.length >= 2): [];

    // console.log("validBins", validBins)

    const singleTreeLayers = bins && Object.keys(bins).length > 0 ? Object.values(bins).filter(bin => bin?.path !== null && bin.visible).map((bin, i) => {

      // if (!bin.path) return null; // don't add to array if no path

      let divide_pos = bin.acc / globalBpPerUnit;

      return new PathLayer({
        id: `main-layer-${bin.global_index}`,
        data: bin.path,
        getPath: d => d?.path?.map(([x, y]) => {
              return [
              x + divide_pos,
              y 
            ]}),
        getColor: d => {
          if (hoveredTreeIndex && d.path === hoveredTreeIndex.path) {
            return [0,0,0, 255]
          }
          return [150, 150, 150, 255];
        },
        getWidth: d => {
          if (hoveredTreeIndex && d.path === hoveredTreeIndex.path) {
            return 3
          }
          return 2;
        },
        widthUnits: 'pixels',
        viewId: 'ortho',
        zOffset: -1,
        pickable: true,
        updateTriggers: {
          getWidth: [hoveredTreeIndex],
          data: [bins]
        },
      });
    }) : [];
    // const treeLayers = bins && bins.length > 0 ? new PathLayer({
    //   id: `main-layer`,
    //   data: Array.isArray(bins) ? bins.filter(d => Array.isArray(d.path) && d.path.length >= 2) : [],
    //   // getPath: d => d.path?.map(([x, y]) => {
    //   //   let position = d.acc / globalBpPerUnit;
    //   //   return [x+position, y]
    //   // }),
    //   // getPath: d => (Array.isArray(d.path) ? d.path.map(([x, y]) => [x + d.acc/globalBpPerUnit, y]) : null),
    //   getPath: d => {
    //     if (!Array.isArray(d.path)) return null;
    //     let position = d.acc / globalBpPerUnit;
      
    //     const coords = d.path
    //       .map(p => {
    //         if (Array.isArray(p)) {
    //           // Case: already [x, y]
    //           return [p[0] + position, p[1]];
    //         }
    //         if (p.path && Array.isArray(p.path)) {
    //           // Case: {path: [x, y]}
    //           return [p.path[0] + position, p.path[1]];
    //         }
    //         if (p.position && Array.isArray(p.position)) {
    //           // Case: {name: '10', position: [x, y]}
    //           return [p.position[0] + position, p.position[1]];
    //         }
    //         return null; // unknown format
    //       })
    //       .filter(Boolean);
      
    //     return coords.length >= 2 ? coords : null;
    //   },
    //   getColor: d => {
    //     if (hoveredTreeIndex && d.path === hoveredTreeIndex.path) {
    //       return [0,0,0, 255]
    //     }
    //     return [150, 150, 150, 255];
    //   },
    //   getWidth: d => {
    //     if (hoveredTreeIndex && d.path === hoveredTreeIndex.path) {
    //       return 3
    //     }
    //     return 2;
    //   },
    //   // visible: !hideOrthoLayers,
    //   widthUnits: 'pixels',
    //   // modelMatrix,
    //   viewId: 'ortho',
    //   zOffset: -1,
    //   pickable: true,
    //   updateTriggers: {
    //     getWidth: [hoveredTreeIndex],
    //     data: [bins]
    //   },
    // }) : [];

    return [...singleTreeLayers, genomeGridLayer];

    // const singleTreeLayers = (!bins?.data?.paths)? [] : data.data.paths.flatMap((tree, i) => {
      
      // const singleTreeLayers = bins && bins.length > 0 ? bins.flatMap((tree, i) => {
      // const spacing = 1.03;

      // // const genomePos = data.data.genome_positions[i];
      // // const treeIndex = data.data.tree_index[i];
      // const modelMatrix = new Matrix4().translate([i * spacing,0, 0]);
      // // const pathData = tree.filter(d => d.path);

      // // let divide_pos = globalBins[trees[i]?.global_index]?.acc / globalBpPerUnit;
      // let divide_pos = tree?.acc / globalBpPerUnit;
      // // console.log("pathLayer", "divide_pos", treeIndex,trees, "globalBpPerUnit", globalBpPerUnit, "divide_pos", divide_pos)
      // console.log("pathLayer", "bins", tree)
      // const pathLayer = new PathLayer({
      //   id: `main-layer-${i}`,
      //   // visible: !hideOrthoLayers,
      //   data: tree,
      //   getPath: d => d?.path?.map(([x, y]) => {
      //     return [
      //     x + divide_pos,
      //     y 
      //   ]}),
      //   getColor: d => {
      //     if (hoveredTreeIndex && d.path === hoveredTreeIndex.path) {
      //       return [0,0,0, 255]
      //     }
      //     return [150, 150, 150, 255];
      //   },
      //   getWidth: d => {
      //     if (hoveredTreeIndex && d.path === hoveredTreeIndex.path) {
      //       return 3
      //     }
      //     return 2;
      //   },
      //   // visible: !hideOrthoLayers,
      //   widthUnits: 'pixels',
      //   modelMatrix,
      //   viewId: 'ortho',
      //   zOffset: -1,
      //   pickable: true,
      //   // onHover: ({object, picked}) => {
      //   //   if (picked && object) {
      //   //     setHoveredTreeIndex({...hoveredTreeIndex, path: object.path, treeIndex: treeIndex, node: null});
      //   //   }
      //   //   else{
      //   //     setHoveredTreeIndex({...hoveredTreeIndex,treeIndex:null, path: null, node: null});
      //   //   }
      //   // },
      //   updateTriggers: {
      //     getWidth: [hoveredTreeIndex],
      //     data: [tree]
      //   },
      // });

      // const nodeLayer = new ScatterplotLayer({
      //   id: `main-dots-${i}`,
      //   visible: !hideOrthoLayers,
      //   data: nodeData,
      //   visible: !hideOrthoLayers,
      //   getPosition: d => d.position,
      //   getFillColor: d => {
      //     if (hoveredTreeIndex?.node === d.name) {
      //       return [255, 255, 0, 255]; 
      //     }
      //     return [80, 80, 180, 255]; 
      //   },
      //   getLineColor: [80, 80, 180, 255],
      //   getLineWidth: 1,
      //   opacity: 0.5,
      //   getLineOpacity: 0.5,
      //   getRadius: d => {
      //     // Base radius that scales with zoom
      //     const baseRadius = hoveredTreeIndex?.node === d.name ? 2 : 1;
          
      //     // Scale factor based on zoom level
      //     // Higher zoom = larger scale factor
      //     const currentZoom = Array.isArray(viewState.ortho.zoom) ? viewState.ortho.zoom[0] : viewState.ortho.zoom;
      //     const zoomScale = Math.pow(2, currentZoom - 10); // Adjust base zoom as needed
      //     return baseRadius * Math.max(0.5, Math.min(3, zoomScale)); // Clamp between 0.5x and 3x
      //   },

      //   filled: true,
      //   stroked: true,
      //   lineWidthUnits: "pixels",
      //   radiusUnits: 'pixels',
      //   lineWidthScale:1,
      //   modelMatrix,
      //   viewId: 'ortho',
      //   pickable: true,
      //   zOffset: -1,
      //   onHover: ({object, picked}) => {
      //     if (picked && object) {
      //       setHoveredTreeIndex({...hoveredTreeIndex, node: object.name, treeIndex: treeIndex});
      //     }
      //     else{
      //       setHoveredTreeIndex({...hoveredTreeIndex, node: null, treeIndex: null});
      //     }
      //   },
      //   updateTriggers: {
      //     getFillColor: [hoveredTreeIndex],
      //     getRadius: [hoveredTreeIndex, viewState.zoom] 
      //   }
      // });

    //   const mutationLayer = new IconLayer({
    //     id: `main-mutations-marker-${i}`,
    //     visible: !hideOrthoLayers,
    //     data: mutationData,
    //     visible: !hideOrthoLayers,
    //     getPosition: d => d.position,
    //     getIcon: () => 'marker',
    //     getSize: 10,
    //     sizeScale: 2,
    //     iconAtlas: '/X.png',
    //     iconMapping: {
    //       marker: { x: 0, y: 0, width: 128, height: 128, anchorY: 64}
    //     },
    //     modelMatrix,
    //     viewId: 'ortho',
    //     getColor: [255, 0, 0],
    //     pickable: true,
    //     onHover: ({object}) => {
    //       if (object){
    //         setHoverInfo(object ? { object,index:i} : null);
    //       }
    //       else{
    //         setHoverInfo(null)
    //       }
    //   }
    // });

      // const textLayer = (hoverInfo && hoverInfo.index === i )? new TextLayer({
      //   id: `main-mutation-text-layer`,
      //   visible: !hideOrthoLayers,
      //   data: [hoverInfo.object],
      //   getPosition: d => d.position,
      //   getText: d => d.mutations.join(' ') || 'Hovered Marker',
      //   getSize: 12,
      //   sizeUnits: 'pixels',
      //   getColor: [255, 0, 0],
      //   getBackgroundColor: [255, 255, 255],
      //   getTextAnchor: 'start',
      //   getAlignmentBaseline: 'bottom',
      //   modelMatrix,
      //   viewId: 'ortho'
      // }) : null;
    
      // const genomeLineLayer = new LineLayer({
      //   id: `genome-positions-lines-${i}`,
      //   data: getGenomeLinesCached(genomePos, debouncedZoomX),
      //   getSourcePosition: d => d.sourcePosition,
      //   getTargetPosition: d => d.targetPosition,
      //   getColor: [100, 100, 100, 100],
      //   getWidth: d =>
      //     d.positionstatus === "start" && i === 0
      //       ? 1
      //       : d.positionstatus === "end"
      //       ? 1
      //       : 2,
      //   widthUnits: "pixels",
      //   modelMatrix,
      //   viewId: "genome-positions",
      //   updateTriggers: {
      //     data: [debouncedZoomX]
      //   }
      // });


      // const gapFiller = new SolidPolygonLayer({
      //   id: `genome-positions-filler-${i}`,
      //   data: [{
      //     polygon: [[1, 0], [spacing, 0], [spacing, 2], [1, 2]],
      //     color: i!== settings.number_of_trees ? [100, 100, 100, 100] : [255, 255, 255, 0]
      //   }, 
      //   {
      //     polygon: [[0, 0], [1, 0], [1, 2], [0, 2]],
      //     color: hoveredTreeIndex?.treeIndex === treeIndex ? [150, 230, 250, 60] : [255, 255, 255, 0]
      //   }
      // ],
      //   modelMatrix,
      //   viewId: 'genome-positions',
      //   getPolygon: d => d.polygon,
      //   getFillColor: d => d.color,

      //   updateTriggers: {
      //     getFillColor: [hoveredTreeIndex]
      //   }
      // })

      // const startGenomePosition = i === 0 ? new TextLayer({
      //   id: `genome-positions-start-label-${i}`,
      //   data: (() => {
      //     const start = genomeLineLayer.props.data.find(d => d.positionstatus === 'start');
      //     return [{ position: [start.sourcePosition[0], 1], text: Math.round(start.genomicPosition).toString() }];
      //   })(),
      //   getPosition: d => d.position,
      //   getText: d => d.text,
      //   sizeUnits: 'pixels',
      //   getTextAnchor: 'middle',
      //   getColor: [50, 50, 50, 255],
      //   modelMatrix,
      //   viewId: 'genome-positions',
      //   getBackgroundColor: [255, 255, 255, 220], 
      //   backgroundPadding: [4, 2, 4, 2],
      //   getBorderColor: [150, 150, 150, 255],
      //   getBorderWidth: 1,
      //   fontFamily: 'Arial, sans-serif',
      //   fontWeight: 'bold',
      //   getSize: 12,
      // }) : null;
      
      // const endGenomePosition = i === settings.number_of_trees ? new TextLayer({
      //   id: `genome-positions-end-label-${i}`,
      //   data: (() => {
      //     const end = genomeLineLayer.props.data.find(d => d.positionstatus === 'end');
      //     return [{ position: [end.targetPosition[0], 1], text: Math.round(end.genomicPosition).toString() }];
      //   })(),
      //   getPosition: d => d.position,
      //   getText: d => d.text,
      //   sizeUnits: 'pixels',
      //   getTextAnchor: 'middle',
      //   getColor: [50, 50, 50, 255],
      //   modelMatrix,
      //   viewId: 'genome-positions',
      //   getBackgroundColor: [255, 255, 255, 220], 
      //   backgroundPadding: [4, 2, 4, 2],
      //   getBorderColor: [150, 150, 150, 255],
      //   getBorderWidth: 1,
      //   fontFamily: 'Arial, sans-serif',
      //   fontWeight: 'bold',
      //   getSize: 12,
      // }) : null;

      // const middleGenomePosition = new TextLayer({
      //   id: `genome-positions-middle-label-${i}`,
      //   data: (() => {
      //     const middle = genomeLineLayer.props.data.filter(d => d.positionstatus === 'middle');
      //     return middle.map(m => ({ position: [m.sourcePosition[0], 1], text: Math.round(m.genomicPosition).toString() }));
      //   })(),
      //   getPosition: d => d.position,
      //   getText: d => d.text,
      //   sizeUnits: 'pixels',
      //   getTextAnchor: 'middle',
      //   getColor: [50, 50, 50, 255],
      //   modelMatrix,
      //   viewId: 'genome-positions',
      //   getBackgroundColor: [255, 255, 255, 220], 
      //   backgroundPadding: [4, 2, 4, 2],
      //   getBorderColor: [150, 150, 150, 255],
      //   getBorderWidth: 1,
      //   fontFamily: 'Arial, sans-serif',
      //   fontWeight: 'bold',
      //   getSize: 12,
      // }) 
      
      // const backgroundLayers = new SolidPolygonLayer({
      //   id: `main-background-${i}`,
      //   visible: !hideOrthoLayers,
      //   data: [{
      //     polygon: [
      //       [0, 1], [1, 1], [1, 0], [0, 0]
      //     ],
      //     treeIndex
      //   }],
      //   getPolygon: d => d.polygon,
      //   getFillColor: hoveredTreeIndex?.treeIndex === treeIndex ? [150, 230, 250, 60] : [255,255,255, 0],
      //   // getFillColor: [255,255,255, 0],
      //   getLineColor: d =>
      //     hoveredTreeIndex?.treeIndex === treeIndex ? [110, 50, 50, 150] : [0, 0, 0, 40],
      //   getLineWidth: d => (hoveredTreeIndex?.treeIndex === i ? 10 : 1),
      //   stroked: true,
      //   filled: true,
      //   modelMatrix,
      //   viewId: 'ortho',
      //     updateTriggers: {
      //       getLineColor: [hoveredTreeIndex],
      //       getLineWidth: [hoveredTreeIndex]
      //     }
      // });

      return [
        // pathLayer,
        // boxLayer,
        // nodeLayer,
        // mutationLayer,
        // textLayer,
        // // backgroundLayer,
        // genomeLineLayer,
        // startGenomePosition,
        // endGenomePosition,
        // gapFiller,
        // middleGenomePosition
      ].filter(Boolean);

    // }) : [];

    
    // const coalescenceLayer = new LineLayer({
    //   id: `tree-time-layer`,
    //   data: getCoalescenceLinesCached(times, debouncedZoomY),
    //   getSourcePosition: d => d.sourcePosition,
    //   getTargetPosition: d => d.targetPosition,
    //   getColor: [100, 100, 100, 100],
    //   getWidth: 2,
    //   widthUnits: 'pixels',
    //   viewId: 'tree-time',
    //   // updateTriggers: {
    //   //   data: [debouncedZoomY]
    //   // }
    //   // pickable: true,
    // })
    
    // const coalescenceTimeLabels = new TextLayer({
    //   id: `tree-time-labels`,
    //   data: (() => {
    //     return coalescenceLayer.props.data.map(m => ({ position: [0.5, m.sourcePosition[1]], text: String(m.time) }));
    //   })(),
    //   getPosition: d => d.position,
    //   getText: d => d.text,
    //   sizeUnits: 'pixels',
    //   getTextAnchor: 'middle',
    //   getColor: [50, 50, 50, 255],
    //   viewId: 'tree-time',
    //   getBackgroundColor: [255, 255, 255, 220], 
    //   backgroundPadding: [4, 2, 4, 2],
    //   getBorderColor: [150, 150, 150, 255],
    //   getBorderWidth: 1,
    //   fontFamily: 'Arial, sans-serif',
    //   fontWeight: 'bold',
    //   getSize: 12,
    // }) 

// return [...singleTreeLayers, coalescenceLayer, coalescenceTimeLabels, genomeGridLayer, singleTreeHighlightLayer];
// return [...singleTreeLayers, coalescenceLayer, coalescenceTimeLabels, genomeGridLayer];
  
    // return [ ...singleTreeLayers,backgroundLayer];

  }, [bins, localCoordinates, hoveredTreeIndex]);



  return { layers, layerFilter };
};

export default useLayers;
