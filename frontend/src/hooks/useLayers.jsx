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
//     const getDivisions = (zoom) => {
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

const getCoalescenceLinesCached = (() => {
  const cache = new Map();
  return (coalescencePos, zoom) => {
    const bucketZoom = Math.ceil(zoom); // integer bucket
    const cacheKey = `${coalescencePos.start}-${coalescencePos.end}-${bucketZoom}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const lines = [];
    const getDivisions = (zoom) => {
      if (zoom <= 8) return 10;
      return (zoom-8) * 2 + 10;
    };
    const divisions = getDivisions(bucketZoom);
    let stepsize = (coalescencePos.max_time - coalescencePos.min_time) / divisions;
    for (let i = 0; i <= divisions; i++) {
      const yPosition = i / divisions;
      const time = coalescencePos.min_time + (stepsize * i);
      lines.push({
        sourcePosition: [0.5, yPosition],
        targetPosition: [1, yPosition],
        time: Math.round(time * 10) / 10
      })
    }
    cache.set(cacheKey, lines);
    return lines;
  }
}
)()

function formatBp(n) {
  if (n >= 1e9) return `${(n/1e9).toFixed(2)} Gbp`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)} Mbp`;
  if (n >= 1e3) return `${(n/1e3).toFixed(1)} kbp`;
  return `${Math.round(n)} bp`;
}



const useDebouncedValue = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const useLayers = ({
  data,
  viewState,
  setViewState,
  setHoverInfo,
  hoverInfo,
  hoveredTreeIndex,
  setHoveredTreeIndex,
  settings,
  deckRef,
  config, 
  backend,
  // viewportSize,
  // setViewportSize,
  globalBins,
  setView,
  viewPortCoords,
  value,
  regions,
globalBpPerUnit  
}) => {

  const {bins, trees} = regions;
  
  const debouncedZoomX = useDebouncedValue(
    Array.isArray(viewState.ortho.zoom) ? viewState.ortho.zoom[0] : viewState.ortho.zoom,
    50 // ms debounce
  );
  const debouncedZoomY = useDebouncedValue(
    Array.isArray(viewState.ortho.zoom) ? viewState.ortho.zoom[1] : viewState.ortho.zoom,
    50 // ms debounce
  );

  const layerFilter = useCallback(({ layer, viewport }) => {
    const isOrtho = viewport.id === 'ortho'
    const isGenome = viewport.id === 'genome-positions';
    const isTreeTime = viewport.id === 'tree-time';

    return (
      (isOrtho && layer.id.startsWith('main')) ||
      (isGenome && layer.id.startsWith('genome-positions')) ||
      (isTreeTime && layer.id.startsWith('tree-time'))
    );
  }, [settings]);

  const layers = useMemo(() => {
    // if (!data?.data?.paths) return [];

    const times = data.data?.times || {};
// console.log("uselayers bins", bins, globalBins)
    const genomeGridLayer = new GenomeGridLayer({
      backend: backend,
      id: 'genome-positions-grid',
      // data: genomeGridLines,
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
      showLabels: false,
    });

    // const spacing = 1.0;
    // const singleTreeHighlightLayer = bins && bins.length > 0 ? new TextLayer({
    //   id: `main-layer-highlight`,
    //   data: (() => {
    //     if (!bins || bins.length === 0) return [];
    //     const result = [];
    //     for (let i = 0; i < bins.length; i++) {
    //       const bin = bins[i];
    //       const visible = bin.visibility;
    //       if (visible) {
    //         result.push({
    //           position: [bin.index + 0.5, 0.5],
    //           i,
    //           text: bin.end.toLocaleString("en-US", { maximumFractionDigits: 0 }) + `\n ${bin.index}`,
    //           skip: bin.number_of_skips
    //         });
    //       } else {
    //         result.push({
    //           position: [bin.index + 0.5, 0.5],
    //           i,
    //           text: `skip ${bin.number_of_skips} tree \n ${bin.index}`,
    //           skip: bin.number_of_skips
    //         });
    //       }
    //     }
    //     return result;
    //   })(),
    //   getPosition: d => d.position,
    //   getText: d => d.text,
    //   getColor: [0, 0, 0, 255],
    //   sizeUnits: 'pixels',
    //   getSize: 12,
    //   getTextAnchor: 'middle',
    //   getAlignmentBaseline: 'bottom',
    //   // modelMatrix: d => new Matrix4().translate([d.i * spacing,0, 0]),
    //   viewId: 'ortho',
    //   // updateTriggers: {
    //   //   data: [bins]
    //   // }
    // }) : null;

    const singleTreeHighlightLayer = trees && trees.length > 0 ? new TextLayer({
      id: `main-layer-highlight`,
      data: (() => {
        const result = [];
        for (let i = 0; i < trees.length; i++) {
          const globalBin = globalBins[trees[i].global_index];
          result.push({
            position: [trees[i].position/globalBpPerUnit, 0.5],
            text: `${globalBin.acc.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
            step: trees[i].index,
            global_index: trees[i].global_index,
          })  
        }
          return result;
      })(),
      visible: false,
      getPosition: d => d.position,
      getText: d => d.text,
      sizeUnits: 'pixels',
      getColor: [0, 0, 0, 255],
      getSize: 10,
      highlightColor: [0, 100, 100, 255],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      updateTriggers: {
        data: [bins]
      }
    }) : null;
            
    const singleTreeLayers = (!data?.data?.paths)? [] : data.data.paths.flatMap((tree, i) => {
      const spacing = 1.03;

      const genomePos = data.data.genome_positions[i];
      const treeIndex = data.data.tree_index[i];
      const modelMatrix = settings.vertical_mode ? new Matrix4().translate([0, i * spacing, 0]) : new Matrix4().translate([i * spacing,0, 0]);
      const pathData = tree.filter(d => d.path);
      const nodeData = tree.filter(d => d.position);
// var bin = bins[i]
// var nextbin = bins[i+1]
      // const mutationData = tree.filter(d => 'mutations' in d);
      // const boxLayer = new SolidPolygonLayer({
      //   id: `main-box-${i}`,
      //   data: [{
      //     // left top, right top, right bottom, left bottom
      //     // polygon: [[0, 0], [1, 0], [1, 1], [0, 1]],
      //     polygon: [
      //       [bin.sourcePosition[0], bin.sourcePosition[1]],
      //        [nextbin.sourcePosition[0]-0.02, nextbin.sourcePosition[1]],
      //        [nextbin.targetPosition[0]-0.02, nextbin.targetPosition[1]],
      //        [bin.targetPosition[0], bin.targetPosition[1]],
      //       ],
      //     color: [255, 124, 200, 100]
      //   }],
      //   getPolygon: d => d.polygon,
      //   getFillColor: d => d.color,
      //   stroked: true,
      //   filled: true,
      //   lineWidthUnits: "pixels",
      //   lineWidthScale: 1,
      //   getLineWidth: 1,
      //   borderColor: [0, 0, 0, 255],
      //   borderWidth: 1,
      //   // modelMatrix
      // })

      let divide_pos = trees[i]?.position / globalBpPerUnit;
      console.log("pathLayer", "divide_pos", treeIndex,trees, "globalBpPerUnit", globalBpPerUnit, "divide_pos", divide_pos)
      
      const pathLayer = new PathLayer({
        id: `main-layer-${i}`,
        // visible: !hideOrthoLayers,
        data: pathData,
        getPath: d => d.path.map(([x, y]) => {
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
        // () => [255, 80, 200],
        getWidth: d => {
          if (hoveredTreeIndex && d.path === hoveredTreeIndex.path) {
            return 3
          }
          return 2;
        },
        // visible: !hideOrthoLayers,
        widthUnits: 'pixels',
        modelMatrix,
        viewId: 'ortho',
        zOffset: -1,
        pickable: true,
        onHover: ({object, picked}) => {
          if (picked && object) {
            setHoveredTreeIndex({...hoveredTreeIndex, path: object.path, treeIndex: treeIndex, node: null});
          }
          else{
            setHoveredTreeIndex({...hoveredTreeIndex,treeIndex:null, path: null, node: null});
          }
        },
        updateTriggers: {
          getWidth: [hoveredTreeIndex]
        },
      });

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
        pathLayer,
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

    });

    
    const coalescenceLayer = new LineLayer({
      id: `tree-time-layer`,
      data: getCoalescenceLinesCached(times, debouncedZoomY),
      getSourcePosition: d => d.sourcePosition,
      getTargetPosition: d => d.targetPosition,
      getColor: [100, 100, 100, 100],
      getWidth: 2,
      widthUnits: 'pixels',
      viewId: 'tree-time',
      // updateTriggers: {
      //   data: [debouncedZoomY]
      // }
      // pickable: true,
    })
    
    const coalescenceTimeLabels = new TextLayer({
      id: `tree-time-labels`,
      data: (() => {
        return coalescenceLayer.props.data.map(m => ({ position: [0.5, m.sourcePosition[1]], text: String(m.time) }));
      })(),
      getPosition: d => d.position,
      getText: d => d.text,
      sizeUnits: 'pixels',
      getTextAnchor: 'middle',
      getColor: [50, 50, 50, 255],
      viewId: 'tree-time',
      getBackgroundColor: [255, 255, 255, 220], 
      backgroundPadding: [4, 2, 4, 2],
      getBorderColor: [150, 150, 150, 255],
      getBorderWidth: 1,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      getSize: 12,
    }) 

// return [...singleTreeLayers, coalescenceLayer, coalescenceTimeLabels, genomeGridLayer, singleTreeHighlightLayer];
// return [...singleTreeLayers, coalescenceLayer, coalescenceTimeLabels, genomeGridLayer];
return [...singleTreeLayers,genomeGridLayer, singleTreeHighlightLayer];
    // return [ ...singleTreeLayers,backgroundLayer];

  }, [data, globalBins, bins, deckRef, viewState.zoom, viewState['genome-positions'], hoverInfo, hoveredTreeIndex, settings]);



  return { layers, layerFilter };
};

export default useLayers;
