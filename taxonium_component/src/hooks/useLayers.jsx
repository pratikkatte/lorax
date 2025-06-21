import {
  LineLayer,
  ScatterplotLayer,
  TextLayer,
  PathLayer,
  IconLayer,
  SolidPolygonLayer
} from "@deck.gl/layers";
import { Matrix4, Vector3 } from "@math.gl/core";
import { useMemo, useCallback, useState } from "react";

const useLayers = ({
  data,
  viewState,
  setHoverInfo,
  hoverInfo,
  hoveredTreeIndex,
  setHoveredTreeIndex,
}) => {
  const layerFilter = useCallback(({ layer, viewport }) => {
    const isOrtho = viewport.id === 'ortho';
    const isGenome = viewport.id === 'genome-positions';
    return (
      (isOrtho && layer.id.startsWith('main')) ||
      (isGenome && layer.id.startsWith('genome-positions'))
    );
  }, []);

  
  const layers = useMemo(() => {
    if (!data?.data?.paths) return [];

    return data.data.paths.flatMap((tree, i) => {
      const genomePos = data.data.genome_positions[i];
      const treeIndex = data.data.tree_index[i];
      const modelMatrix = new Matrix4().translate([0, i * 1.2, 0]);
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

      const lineLayer = new LineLayer({
        id: `genome-positions-line-${i}`,
        data: [{ sourcePosition: [0, 0], targetPosition: [0, 1] }],
        getSourcePosition: d => d.sourcePosition,
        getTargetPosition: d => d.targetPosition,
        getColor: [0, 0, 255],
        getWidth: 4,
        widthUnits: 'pixels',
        modelMatrix,
        viewId: 'genome-positions',
      });

      const topLabelLayer = i === 0 ? new TextLayer({
        id: `genome-positions-top-label-${i}`,
        data: [{ position: [0, -0.01], text: String(genomePos.start) }],
        getPosition: d => d.position,
        getText: d => d.text,
        getColor: [0, 0, 0],
        getSize: 10,
        sizeUnits: 'pixels',
        getAlignmentBaseline: 'bottom',
        modelMatrix,
        viewId: 'genome-positions',
      }) : null;

      const bottomLabelLayer = new TextLayer({
        id: `genome-positions-bottom-label-${i}`,
        data: [{ position: [0, 1.15], text: String(genomePos.end) }],
        getPosition: d => d.position,
        getText: d => d.text,
        getColor: [0, 0, 0],
        getSize: 10,
        sizeUnits: 'pixels',
        getAlignmentBaseline: 'bottom',
        modelMatrix,
        viewId: 'genome-positions',
      });

      const backgroundLayer = new SolidPolygonLayer({
        id: `main-background-${i}`,
        data: [{
          polygon: [
            [0, 1], [1, 1], [1, 0], [0, 0]
          ],
          treeIndex
        }],
        // autoHighlight: true,
        // highlightColor: [150, 230, 250, 60],
        // highlightColor: [0, 0, 0, 40],
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
        lineLayer,
        topLabelLayer,
        bottomLabelLayer,
        textLayer,
        backgroundLayer
      ].filter(Boolean);
    });
  }, [data, viewState.zoom, hoverInfo, hoveredTreeIndex]);

  return { layers, layerFilter };
};

export default useLayers;
