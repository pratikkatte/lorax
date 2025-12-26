
// TreeLayer.js
import { CompositeLayer } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import { GL } from '@luma.gl/constants' // Note the ESM import
import { DNA } from 'react-loader-spinner';

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

  renderLayers() {
    const { bin, viewId, hoveredTreeIndex, populationFilter, xzoom, sampleDetails, metadataColors, treeColors, searchTerm, searchTags, lineagePaths, highlightedNodes, highlightedMutationNode } = this.props;


    // when searched for a sample name.
    // then disable the subsampling of the tree. 
    // and whichever sample name is searched for, the node size should be increased. and the other nodes should be dimmed.


    if (!bin || !bin.path || !bin.modelMatrix || !bin.visible) return null

    const nodes = bin.path.filter(d =>
      d?.position !== undefined &&
      d?.position !== null &&
      d?.mutations === undefined
    )

    const len_nodes = nodes.length;
    const m = bin.modelMatrix;
    const scale_position = m[0];
    const translate_position = m[12];
    let display_labels = false;

    const mutations = bin.path.filter(d => d?.mutations !== undefined && d?.mutations !== null)



    const proportionOfNodesOnTree = len_nodes / (2 ** xzoom * scale_position);
    if (proportionOfNodesOnTree < 0.2) {
      display_labels = true;
    }

    const layers = [
      new PathLayer({
        id: `${this.props.id}-path-${bin.global_index}`,
        data: bin.path,
        getPath: d => {
          if (!d?.path) return null;
          const paths = d?.path;
          const transformedPath = paths?.map(p => {
            const world = [p[0] * scale_position + translate_position, p[1]];
            return world;
          })
          return transformedPath
        },
        jointRounded: true,
        capRounded: true,
        getColor: d => {
          if (treeColors) {
            const key = String(bin.global_index);
            if (treeColors[key]) {
              const hex = treeColors[key];
              // console.log(`TreeLayer ${key} color override:`, hex);
              const r = parseInt(hex.slice(1, 3), 16);
              const g = parseInt(hex.slice(3, 5), 16);
              const b = parseInt(hex.slice(5, 7), 16);
              return [r, g, b, 255];
            }
          }

          return hoveredTreeIndex && d.path === hoveredTreeIndex.path
            ? [50, 50, 50, 255]
            : [150, 145, 140, 230]
        },
        getWidth: d =>
          hoveredTreeIndex && d.path === hoveredTreeIndex.path ? 2 : 1.2,
        widthUnits: 'pixels',
        viewId,
        modelMatrix: null,
        pickable: true,
        coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
        zOffset: -1,
        fp64: true,
        updateTriggers: {
          getWidth: [hoveredTreeIndex],
          getColor: [hoveredTreeIndex, treeColors],
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
          // const m = bin.modelMatrix;
          // const translate_position = m[12];
          // const scale_position = m[0];
          const position = [d.position[0] * scale_position + translate_position, d.position[1]];
          return position;
        },
        getFillColor: d => {
          const colorBy = populationFilter?.colorBy;
          let color = [150, 150, 150, 100];
          let computedColor = color;

          // Color by metadata key from sampleDetails
          if (colorBy && metadataColors && metadataColors[colorBy] && sampleDetails) {
            const val = sampleDetails[d.name]?.[colorBy];
            // If value exists and is enabled, return its color
            if (val !== undefined && val !== null && populationFilter.enabledValues?.includes(String(val))) {
              const c = metadataColors[colorBy][String(val)];
              if (c) computedColor = [...c.slice(0, 3), 200];
            }
          }

          return computedColor;
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
          getFillColor: [populationFilter.colorBy, populationFilter.enabledValues],
          data: [bin.modelMatrix, bin.path],

        },
      }),
    ];

    // Add dedicated layer for highlighted nodes from search
    if (highlightedNodes && highlightedNodes[bin.global_index]) {
      const highlightData = highlightedNodes[bin.global_index];
      layers.push(
        new ScatterplotLayer({
          id: `${this.props.id}-highlights-${bin.global_index}`,
          data: highlightData,
          getPosition: d => {
            // const m = bin.modelMatrix;
            // const translate_position = m[12];
            // const scale_position = m[0];
            const position = [d.position[0] * scale_position + translate_position, d.position[1]];
            return position;
          },
          getFillColor: d => {
            // Use the same assigned color logic but fully opaque/brighter
            const colorBy = populationFilter?.colorBy;
            if (colorBy && metadataColors && metadataColors[colorBy] && sampleDetails) {
              const val = sampleDetails[d.name]?.[colorBy];
              if (val !== undefined && val !== null) {
                const c = metadataColors[colorBy][String(val)];
                if (c) return [...c.slice(0, 3), 255];
              }
            }
            return [255, 0, 0, 150]; // Default bright red if no metadata color
          },
          getLineColor: d => {
            const colorBy = populationFilter?.colorBy;
            if (colorBy && metadataColors && metadataColors[colorBy] && sampleDetails) {
              const val = sampleDetails[d.name]?.[colorBy];
              if (val !== undefined && val !== null) {
                const c = metadataColors[colorBy][String(val)];
                if (c) return [...c.slice(0, 3), 255];
              }
            }
            return [255, 0, 0, 255]; // Default bright red if no metadata color
          },
          getLineWidth: 1,
          getRadius: 4, // Larger radius for highlights
          radiusMinPixels: 3,
          stroked: true,
          lineWidthUnits: 'pixels',
          radiusUnits: 'pixels',
          coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
          viewId,
          modelMatrix: null,
          pickable: true,
          zOffset: 2, // Ensure it draws on top
          updateTriggers: {
            data: [highlightData, bin.modelMatrix],
            getFillColor: [populationFilter.colorBy]
          }
        })
      );
    }

    if (lineagePaths && lineagePaths[bin.global_index]) {
      const lineageData = lineagePaths[bin.global_index];
      layers.push(
        new PathLayer({
          id: `${this.props.id}-lineage-path-${bin.global_index}`,
          data: lineageData,
          getPath: d => {
            if (!d?.path) return null;
            const paths = d?.path;
            const transformedPath = paths?.map(p => {
              const world = [p[0] * scale_position + translate_position, p[1]];
              return world;
            })
            return transformedPath
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
            data: [lineageData, bin.modelMatrix]
          }
        })
      );
    }

    if (display_labels) {
      layers.push(new TextLayer({
        id: `${this.props.id}-text-${bin.global_index}`,
        data: bin.path.filter(d =>
          d?.position !== undefined &&
          d?.position !== null &&
          d?.mutations === undefined
        ),
        getPosition: d => {
          const position = [d.position[0] * scale_position + translate_position, d.position[1]];
          return position;
        },
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
        getSize: () => (6 + Math.log2(Math.max(xzoom, 1))),
        getAlignmentBaseline: 'center',
        getTextAnchor: 'end',
        getAngle: 90,
        updateTriggers: {
          data: [bin.modelMatrix, bin.path],
          getText: [bin.path]
        }
      }));
    }

    // Mutations IconLayer
    const mutationsData = bin.path.filter(d => d?.mutations !== undefined && d?.mutations !== null);

    layers.push(new IconLayer({
      id: `${this.props.id}-mutations-${bin.global_index}`,
      data: mutationsData,
      getPosition: d => {
        const position = [d.position[0] * scale_position + translate_position, d.position[1]];
        return position;
      },
      getIcon: () => 'marker',
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
        data: [bin.path, bin.modelMatrix],
      },
    }));

    // Highlight circle around mutation with matching node name
    if (highlightedMutationNode !== null) {
      const highlightedMutation = mutationsData.find(d => d.name === highlightedMutationNode);
      if (highlightedMutation) {
        layers.push(new ScatterplotLayer({
          id: `${this.props.id}-mutation-highlight-${bin.global_index}`,
          data: [highlightedMutation],
          getPosition: d => {
            const position = [d.position[0] * scale_position + translate_position, d.position[1]];
            return position;
          },
          getFillColor: [0, 0, 0, 0], // Transparent fill
          getLineColor: [0, 0, 0, 255], // Emerald-500 green circle
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
            data: [highlightedMutationNode, bin.path, bin.modelMatrix],
          },
        }));
      }
    }

    return layers;
  }
}