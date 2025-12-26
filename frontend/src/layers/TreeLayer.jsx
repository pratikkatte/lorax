
// TreeLayer.js
import { CompositeLayer } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { COORDINATE_SYSTEM } from '@deck.gl/core';

export default class TreeLayer extends CompositeLayer {
  static defaultProps = {
    bin: null,
    globalBpPerUnit: 1,
    hoveredTreeIndex: null,
    treeSpacing: 1.03,
    viewId: 'ortho',
    populationFilter: null,
    yzoom: null,
    xzoom: null,
    sampleDetails: null,
    metadataColors: null,
    treeColors: null,
    searchTerm: null,
    searchTags: [],
    lineagePaths: null,
    highlightedNodes: null,
    highlightedMutationNode: null,
  };

  // Cache filtered data to avoid repeated filtering on each render
  // This significantly reduces memory allocations
  initializeState() {
    this.state = {
      nodesData: null,
      mutationsData: null,
      lastPathRef: null,
    };
  }

  updateState({ props, oldProps, changeFlags }) {
    // Only recompute filtered data when bin.path actually changes
    const pathChanged = props.bin?.path !== this.state.lastPathRef;
    
    if (pathChanged && props.bin?.path) {
      const path = props.bin.path;
      
      // Single pass through data to separate nodes and mutations
      const nodes = [];
      const mutations = [];
      
      for (let i = 0; i < path.length; i++) {
        const d = path[i];
        if (d?.mutations !== undefined && d?.mutations !== null) {
          mutations.push(d);
        } else if (d?.position !== undefined && d?.position !== null) {
          nodes.push(d);
        }
      }
      
      this.setState({
        nodesData: nodes,
        mutationsData: mutations,
        lastPathRef: path,
      });
    }
  }
  
  // Clean up state when layer is finalized to help GC
  finalizeState() {
    this.setState({
      nodesData: null,
      mutationsData: null,
      lastPathRef: null,
    });
  }

  renderLayers() {
    const { bin, viewId, hoveredTreeIndex, populationFilter, xzoom, sampleDetails, metadataColors, treeColors, lineagePaths, highlightedNodes, highlightedMutationNode } = this.props;

    if (!bin || !bin.path || !bin.modelMatrix || !bin.visible) return null;

    // Use cached filtered data
    const nodesData = this.state.nodesData || [];
    const mutationsData = this.state.mutationsData || [];
    
    const len_nodes = nodesData.length;
    const m = bin.modelMatrix;
    const scale_position = m[0];
    const translate_position = m[12];
    let display_labels = false;



    const proportionOfNodesOnTree = len_nodes / (2 ** xzoom * scale_position);
    if (proportionOfNodesOnTree < 0.2) {
      display_labels = true;
    }

    // Pre-compute tree color once (avoid repeated lookups in accessor)
    let treeColor = null;
    if (treeColors) {
      const key = String(bin.global_index);
      if (treeColors[key]) {
        const hex = treeColors[key];
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        treeColor = [r, g, b, 255];
      }
    }
    
    // Cache hover path reference for faster comparison
    const hoveredPath = hoveredTreeIndex?.path;
    
    // Pre-compute colors for enabled metadata values (avoid repeated lookups)
    const colorBy = populationFilter?.colorBy;
    const enabledValues = populationFilter?.enabledValues;

    const layers = [
      new PathLayer({
        id: `${this.props.id}-path-${bin.global_index}`,
        data: bin.path,
        getPath: d => {
          if (!d?.path) return null;
          const paths = d.path;
          // Reuse array when possible - deck.gl handles the transformation
          const len = paths.length;
          const result = new Array(len);
          for (let i = 0; i < len; i++) {
            const p = paths[i];
            result[i] = [p[0] * scale_position + translate_position, p[1]];
          }
          return result;
        },
        jointRounded: true,
        capRounded: true,
        getColor: treeColor 
          ? () => treeColor  // Use constant color if tree has override
          : (d => hoveredPath && d.path === hoveredPath
              ? [50, 50, 50, 255]
              : [150, 145, 140, 230]),
        getWidth: hoveredPath 
          ? (d => d.path === hoveredPath ? 2 : 1.2)
          : 1.2, // Use constant when no hover
        widthUnits: 'pixels',
        viewId,
        modelMatrix: null,
        pickable: true,
        coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
        zOffset: -1,
        fp64: true,
        updateTriggers: {
          getWidth: [hoveredPath],
          getColor: [hoveredPath, treeColor],
          getPath: [scale_position, translate_position],
        },
      }),

      new ScatterplotLayer({
        id: `${this.props.id}-samples-${bin.global_index}`,
        data: nodesData, // Use cached filtered data
        getPosition: d => [d.position[0] * scale_position + translate_position, d.position[1]],
        getFillColor: d => {
          // Optimized color lookup
          if (colorBy && metadataColors?.[colorBy] && sampleDetails) {
            const val = sampleDetails[d.name]?.[colorBy];
            if (val !== undefined && val !== null && enabledValues?.includes(String(val))) {
              const c = metadataColors[colorBy][String(val)];
              if (c) return [c[0], c[1], c[2], 200];
            }
          }
          return [150, 150, 150, 100];
        },
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineColor: [120, 120, 120, 120],
        getLineWidth: 0.5,
        getRadius: 2,
        radiusMinPixels: 1.2,
        radiusUnits: 'pixels',
        coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
        pickable: true,
        modelMatrix: null,
        viewId,
        updateTriggers: {
          getFillColor: [colorBy, enabledValues],
          getPosition: [scale_position, translate_position],
        },
      }),
    ];

    // Add dedicated layer for highlighted nodes from search
    const highlightData = highlightedNodes?.[bin.global_index];
    if (highlightData && highlightData.length > 0) {
      // Helper for color lookup (shared between fill and line)
      const getHighlightColor = d => {
        if (colorBy && metadataColors?.[colorBy] && sampleDetails) {
          const val = sampleDetails[d.name]?.[colorBy];
          if (val !== undefined && val !== null) {
            const c = metadataColors[colorBy][String(val)];
            if (c) return [c[0], c[1], c[2], 255];
          }
        }
        return [255, 0, 0, 255];
      };

      layers.push(
        new ScatterplotLayer({
          id: `${this.props.id}-highlights-${bin.global_index}`,
          data: highlightData,
          getPosition: d => [d.position[0] * scale_position + translate_position, d.position[1]],
          getFillColor: getHighlightColor,
          getLineColor: getHighlightColor,
          getLineWidth: 1,
          getRadius: 4,
          radiusMinPixels: 3,
          stroked: true,
          lineWidthUnits: 'pixels',
          radiusUnits: 'pixels',
          coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
          viewId,
          modelMatrix: null,
          pickable: true,
          zOffset: 2,
          updateTriggers: {
            getFillColor: [colorBy],
            getPosition: [scale_position, translate_position],
          }
        })
      );
    }

    const lineageData = lineagePaths?.[bin.global_index];
    if (lineageData && lineageData.length > 0) {
      layers.push(
        new PathLayer({
          id: `${this.props.id}-lineage-path-${bin.global_index}`,
          data: lineageData,
          getPath: d => {
            if (!d?.path) return null;
            const paths = d.path;
            const len = paths.length;
            const result = new Array(len);
            for (let i = 0; i < len; i++) {
              const p = paths[i];
              result[i] = [p[0] * scale_position + translate_position, p[1]];
            }
            return result;
          },
          jointRounded: true,
          capRounded: true,
          getColor: d => d.color || [255, 0, 0, 255],
          getWidth: 1.5,
          widthUnits: 'pixels',
          viewId,
          modelMatrix: null,
          coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
          zOffset: 1,
          fp64: true,
          updateTriggers: {
            getPath: [scale_position, translate_position]
          }
        })
      );
    }

    if (display_labels && nodesData.length > 0) {
      // Pre-compute font size
      const fontSize = 6 + Math.log2(Math.max(xzoom, 1));
      
      layers.push(new TextLayer({
        id: `${this.props.id}-text-${bin.global_index}`,
        data: nodesData, // Use cached data
        getPosition: d => [d.position[0] * scale_position + translate_position, d.position[1]],
        getText: d => d.name,
        fontFamily: "'Inter', 'Roboto', 'Arial', sans-serif",
        getColor: [10, 10, 10, 255],
        getBackgroundColor: [255, 255, 255, 230],
        getPixelOffset: [0, 6],
        backgroundPadding: [4, 2],
        shadowColor: [100, 100, 100, 180],
        shadowBlur: 2,
        viewId,
        modelMatrix: null,
        coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
        sizeUnits: 'pixels',
        getSize: fontSize, // Use constant instead of function
        getAlignmentBaseline: 'center',
        getTextAnchor: 'end',
        getAngle: 90,
        updateTriggers: {
          getPosition: [scale_position, translate_position],
          getSize: [xzoom]
        }
      }));
    }

    // Mutations IconLayer - only render if there are mutations
    if (mutationsData.length > 0) {
      layers.push(new IconLayer({
        id: `${this.props.id}-mutations-${bin.global_index}`,
        data: mutationsData, // Use cached data
        getPosition: d => [d.position[0] * scale_position + translate_position, d.position[1]],
        getIcon: 'marker', // Constant string, not function
        modelMatrix: null,
        getColor: [255, 0, 0, 255],
        viewId,
        getSize: 12,
        sizeUnits: 'pixels',
        iconAtlas: '/X.png',
        iconMapping: {
          marker: { x: 0, y: 0, width: 128, height: 128, mask: true }
        },
        pickable: true,
        updateTriggers: {
          getPosition: [scale_position, translate_position],
        },
      }));
    }

    // Highlight circle around mutation with matching node name
    if (highlightedMutationNode !== null && mutationsData.length > 0) {
      const highlightedMutation = mutationsData.find(d => d.name === highlightedMutationNode);
      if (highlightedMutation) {
        layers.push(new ScatterplotLayer({
          id: `${this.props.id}-mutation-highlight-${bin.global_index}`,
          data: [highlightedMutation],
          getPosition: d => [d.position[0] * scale_position + translate_position, d.position[1]],
          getFillColor: [0, 0, 0, 0],
          getLineColor: [0, 0, 0, 255],
          getLineWidth: 2,
          getRadius: 10,
          stroked: true,
          filled: false,
          lineWidthUnits: 'pixels',
          radiusUnits: 'pixels',
          coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
          viewId,
          modelMatrix: null,
          updateTriggers: {
            getPosition: [scale_position, translate_position],
          },
        }));
      }
    }

    return layers;
  }
}