import {
  LineLayer,
  ScatterplotLayer,
  TextLayer,
  PathLayer,
  IconLayer,
  SolidPolygonLayer
} from "@deck.gl/layers";
import { Matrix4, Vector3 } from "@math.gl/core";
import { useMemo, useCallback, useState, useEffect } from "react";

const getGenomeLinesCached = (() => {
  const cache = new Map();
  return (genomePos, zoom) => {
    const bucketZoom = Math.ceil(zoom); // integer bucket
    const cacheKey = `${genomePos.start}-${genomePos.end}-${bucketZoom}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    // const divisions = bucketZoom <= 9 ? 10 : 20
    const getDivisions = (zoom) => {
      if (zoom <= 8) return 10;
      return (zoom) * 2;
    };
    const divisions = getDivisions(bucketZoom);
    const stepSize = (genomePos.end - genomePos.start) / divisions;
    const middle = 5;
    const lines = [];

    for (let j = 0; j <= divisions; j++) {
      const xPosition = j / divisions;
      const genomicPosition = genomePos.start + (stepSize * j);
      const positionstatus =
        j === 0
          ? "start"
          : j === divisions
          ? "end"
          : j % middle === 0
          ? "middle"
          : null;

      lines.push({
        sourcePosition: [xPosition, 0],
        targetPosition: [xPosition, 2],
        genomicPosition,
        positionstatus
      });
    }

    cache.set(cacheKey, lines);
    return lines;
  };
})();

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
  setHoverInfo,
  hoverInfo,
  hoveredTreeIndex,
  setHoveredTreeIndex,
  settings,
  config,
}) => {
  
  const debouncedZoomX = useDebouncedValue(
    Array.isArray(viewState.ortho.zoom) ? viewState.ortho.zoom[0] : viewState.ortho.zoom,
    50 // ms debounce
  );
  const debouncedZoomY = useDebouncedValue(
    Array.isArray(viewState.ortho.zoom) ? viewState.ortho.zoom[1] : viewState.ortho.zoom,
    50 // ms debounce
  );


  const layerFilter = useCallback(({ layer, viewport }) => {
    const isOrtho = viewport.id === 'ortho';
    const isGenome = viewport.id === 'genome-positions';
    const isTreeTime = viewport.id === 'tree-time';
    return (
      (isOrtho && layer.id.startsWith('main')) ||
      (isGenome && layer.id.startsWith('genome-positions')) ||
      (isTreeTime && layer.id.startsWith('tree-time'))
    );
  }, [settings]);
  

  const layers = useMemo(() => {
    if (!data?.data?.paths) return [];

    const times = data.data?.times || {};



    const singleTreeLayers = data.data.paths.flatMap((tree, i) => {
      const spacing = 1.03;

      const genomePos = data.data.genome_positions[i];
      const treeIndex = data.data.tree_index[i];
      const modelMatrix = settings.vertical_mode ? new Matrix4().translate([0, i * spacing, 0]) : new Matrix4().translate([i * spacing,0, 0]);
      const pathData = tree.filter(d => d.path);
      const nodeData = tree.filter(d => d.position);

      const mutationData = tree.filter(d => 'mutations' in d);

      
      const pathLayer = new PathLayer({
        id: `main-layer-${i}`,
        data: pathData,
        getPath: d => d.path,
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
        }
      });

      const nodeLayer = new ScatterplotLayer({
        id: `main-dots-${i}`,
        data: nodeData,
        getPosition: d => d.position,
        getFillColor: d => {
          if (hoveredTreeIndex?.node === d.name) {
            return [255, 255, 0, 255]; 
          }
          return [80, 80, 180, 255]; 
        },
        getLineColor: [80, 80, 180, 255],
        getLineWidth: 1,
        opacity: 0.5,
        getLineOpacity: 0.5,
        getRadius: d => {
          // Base radius that scales with zoom
          const baseRadius = hoveredTreeIndex?.node === d.name ? 2 : 1;
          
          // Scale factor based on zoom level
          // Higher zoom = larger scale factor
          const currentZoom = Array.isArray(viewState.ortho.zoom) ? viewState.ortho.zoom[0] : viewState.ortho.zoom;
          const zoomScale = Math.pow(2, currentZoom - 10); // Adjust base zoom as needed
          return baseRadius * Math.max(0.5, Math.min(3, zoomScale)); // Clamp between 0.5x and 3x
        },

        filled: true,
        stroked: true,
        lineWidthUnits: "pixels",
        radiusUnits: 'pixels',
        lineWidthScale:1,
        modelMatrix,
        viewId: 'ortho',
        pickable: true,
        zOffset: -1,
        onHover: ({object, picked}) => {
          if (picked && object) {
            setHoveredTreeIndex({...hoveredTreeIndex, node: object.name, treeIndex: treeIndex});
          }
          else{
            setHoveredTreeIndex({...hoveredTreeIndex, node: null, treeIndex: null});
          }
        },
        updateTriggers: {
          getFillColor: [hoveredTreeIndex],
          getRadius: [hoveredTreeIndex, viewState.zoom] 
        }
      });

      const mutationLayer = new IconLayer({
        id: `main-mutations-marker-${i}`,
        data: mutationData,
        getPosition: d => d.position,
        getIcon: () => 'marker',
        getSize: 10,
        sizeScale: 2,
        iconAtlas: '/X.png',
        iconMapping: {
          marker: { x: 0, y: 0, width: 128, height: 128, anchorY: 64}
        },
        modelMatrix,
        viewId: 'ortho',
        getColor: [255, 0, 0],
        pickable: true,
        onHover: ({object}) => {
          if (object){
            setHoverInfo(object ? { object,index:i} : null);
          }
          else{
            setHoverInfo(null)
          }
      }
    });

      const textLayer = (hoverInfo && hoverInfo.index === i )? new TextLayer({
        id: `main-mutation-text-layer`,
        data: [hoverInfo.object],
        getPosition: d => d.position,
        getText: d => d.mutations.join(' ') || 'Hovered Marker',
        getSize: 12,
        sizeUnits: 'pixels',
        getColor: [255, 0, 0],
        getBackgroundColor: [255, 255, 255],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'bottom',
        modelMatrix,
        viewId: 'ortho'
      }) : null;

    
      const genomeLineLayer = new LineLayer({
        id: `genome-positions-lines-${i}`,
        data: getGenomeLinesCached(genomePos, debouncedZoomX),
        getSourcePosition: d => d.sourcePosition,
        getTargetPosition: d => d.targetPosition,
        getColor: [100, 100, 100, 100],
        getWidth: d =>
          d.positionstatus === "start" && i === 0
            ? 1
            : d.positionstatus === "end"
            ? 1
            : 2,
        widthUnits: "pixels",
        modelMatrix,
        viewId: "genome-positions",
        updateTriggers: {
          data: [debouncedZoomX]
        }
      });


      const gapFiller = new SolidPolygonLayer({
        id: `genome-positions-filler-${i}`,
        data: [{
          polygon: [[1, 0], [spacing, 0], [spacing, 2], [1, 2]],
          color: i!== settings.number_of_trees ? [100, 100, 100, 100] : [255, 255, 255, 0]
        }, 
        {
          polygon: [[0, 0], [1, 0], [1, 2], [0, 2]],
          color: hoveredTreeIndex?.treeIndex === i ? [150, 230, 250, 60] : [255, 255, 255, 0]
        }
      ],
        modelMatrix,
        viewId: 'genome-positions',
        getPolygon: d => d.polygon,
        getFillColor: d => d.color,

        updateTriggers: {
          getFillColor: [hoveredTreeIndex]
        }
      })

      const startGenomePosition = i === 0 ? new TextLayer({
        id: `genome-positions-start-label-${i}`,
        data: (() => {
          const start = genomeLineLayer.props.data.find(d => d.positionstatus === 'start');
          return [{ position: [start.sourcePosition[0], 1], text: Math.round(start.genomicPosition).toString() }];
        })(),
        getPosition: d => d.position,
        getText: d => d.text,
        sizeUnits: 'pixels',
        getTextAnchor: 'middle',
        getColor: [50, 50, 50, 255],
        modelMatrix,
        viewId: 'genome-positions',
        getBackgroundColor: [255, 255, 255, 220], 
        backgroundPadding: [4, 2, 4, 2],
        getBorderColor: [150, 150, 150, 255],
        getBorderWidth: 1,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        getSize: 12,
      }) : null;
      
      const endGenomePosition = i === settings.number_of_trees ? new TextLayer({
        id: `genome-positions-end-label-${i}`,
        data: (() => {
          const end = genomeLineLayer.props.data.find(d => d.positionstatus === 'end');
          return [{ position: [end.targetPosition[0], 1], text: Math.round(end.genomicPosition).toString() }];
        })(),
        getPosition: d => d.position,
        getText: d => d.text,
        sizeUnits: 'pixels',
        getTextAnchor: 'middle',
        getColor: [50, 50, 50, 255],
        modelMatrix,
        viewId: 'genome-positions',
        getBackgroundColor: [255, 255, 255, 220], 
        backgroundPadding: [4, 2, 4, 2],
        getBorderColor: [150, 150, 150, 255],
        getBorderWidth: 1,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        getSize: 12,
      }) : null;

      const middleGenomePosition = new TextLayer({
        id: `genome-positions-middle-label-${i}`,
        data: (() => {
          const middle = genomeLineLayer.props.data.filter(d => d.positionstatus === 'middle');
          return middle.map(m => ({ position: [m.sourcePosition[0], 1], text: Math.round(m.genomicPosition).toString() }));
        })(),
        getPosition: d => d.position,
        getText: d => d.text,
        sizeUnits: 'pixels',
        getTextAnchor: 'middle',
        getColor: [50, 50, 50, 255],
        modelMatrix,
        viewId: 'genome-positions',
        getBackgroundColor: [255, 255, 255, 220], 
        backgroundPadding: [4, 2, 4, 2],
        getBorderColor: [150, 150, 150, 255],
        getBorderWidth: 1,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        getSize: 12,
      }) 
      
      const backgroundLayer = new SolidPolygonLayer({
        id: `main-background-${i}`,
        data: [{
          polygon: [
            [0, 1], [1, 1], [1, 0], [0, 0]
          ],
          treeIndex
        }],
        getPolygon: d => d.polygon,
        getFillColor: hoveredTreeIndex?.treeIndex === treeIndex ? [150, 230, 250, 60] : [255,255,255, 0],
        // getFillColor: [255,255,255, 0],
        getLineColor: d =>
          hoveredTreeIndex?.treeIndex === treeIndex ? [110, 50, 50, 150] : [0, 0, 0, 40],
        getLineWidth: d => (hoveredTreeIndex?.treeIndex === i ? 10 : 1),
        stroked: true,
        filled: true,
        modelMatrix,
        viewId: 'ortho',
          updateTriggers: {
            getLineColor: [hoveredTreeIndex],
            getLineWidth: [hoveredTreeIndex]
          }
      });

      return [
        pathLayer,
        nodeLayer,
        mutationLayer,
        textLayer,
        backgroundLayer,
        genomeLineLayer,
        startGenomePosition,
        endGenomePosition,
        gapFiller,
        middleGenomePosition
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
      updateTriggers: {
        data: [debouncedZoomY]
      }
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



    return [...singleTreeLayers,coalescenceLayer, coalescenceTimeLabels,];

  }, [data, viewState.zoom, hoverInfo, hoveredTreeIndex, settings]);

  return { layers, layerFilter };
};

export default useLayers;
