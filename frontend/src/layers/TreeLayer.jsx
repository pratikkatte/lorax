
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
    populationFilter: null,
    yzoom: null,
    xzoom: null,
    sampleDetails: null,
    metadataColors: null,
    treeColors: null,
    searchTerm: null,
    searchTags: [],
    lineagePaths: null,
  };

  renderLayers() {
    const { bin, viewId, hoveredTreeIndex, populationFilter, xzoom, sampleDetails, metadataColors, treeColors, searchTerm, searchTags, lineagePaths } = this.props;
  

    // when searched for a sample name.
    // then disable the subsampling of the tree. 
    // and whichever sample name is searched for, the node size should be increased. and the other nodes should be dimmed.


    if (!bin || !bin.path || !bin.modelMatrix || !bin.visible) return null

    const nodes =  bin.path.filter(d => 
      d?.position !== undefined && 
      d?.position !== null && 
      d?.mutations === undefined
    )

    const len_nodes = nodes.length;
    const m = bin.modelMatrix;
    const scale_position = m[0];
    let display_labels = false;

    const proportionOfNodesOnTree = len_nodes / (2 ** xzoom * scale_position);
    if (proportionOfNodesOnTree < 0.2) {
      display_labels = true;
    }

    const layers = [
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
        modelMatrix:null,
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
          const m = bin.modelMatrix;
          const translate_position = m[12];
          const scale_position = m[0];
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
        getLineColor: d => {
          // Check if this node matches any search term
          const activeTerms = [
              ...(searchTerm && searchTerm.trim() !== "" ? [searchTerm.trim().toLowerCase()] : []),
              ...(searchTags || []).map(t => t.toLowerCase())
          ];

          if (activeTerms.length > 0) {
              const dName = d.name ? d.name.toLowerCase() : "";
              const isMatch = activeTerms.some(term => {
                  //  if (dName === term) return true;
                   if (sampleDetails && sampleDetails[d.name]) {
                       return Object.values(sampleDetails[d.name]).some(v => 
                           v !== null && v !== undefined && String(v).toLowerCase() === term
                       );
                   }
                   return false;
              });
              if (isMatch) {
                  // Dark stroke for highlighted nodes
                  return [30, 30, 30, 255];
              }
          }
          // Default light stroke
          return [120, 120, 120, 120];
        },
        getLineWidth: d => {
          // Check if this node matches any search term
          const activeTerms = [
              ...(searchTerm && searchTerm.trim() !== "" ? [searchTerm.trim().toLowerCase()] : []),
              ...(searchTags || []).map(t => t.toLowerCase())
          ];

          if (activeTerms.length > 0) {
              const dName = d.name ? d.name.toLowerCase() : "";
              const isMatch = activeTerms.some(term => {
                  //  if (dName === term) return true;
                   if (sampleDetails && sampleDetails[d.name]) {
                       return Object.values(sampleDetails[d.name]).some(v => 
                           v !== null && v !== undefined && String(v).toLowerCase() === term
                       );
                   }
                   return false;
              });
              if (isMatch) {
                  // Thicker stroke for highlighted nodes
                  return 2;
              }
          }
          // Default thin stroke
          return 0.5;
        },
        getRadius: d => {
            const activeTerms = [
                ...(searchTerm && searchTerm.trim() !== "" ? [searchTerm.trim().toLowerCase()] : []),
                ...(searchTags || []).map(t => t.toLowerCase())
            ];

            if (activeTerms.length > 0) {
                const dName = d.name ? d.name.toLowerCase() : "";
                const isMatch = activeTerms.some(term => {
                    //  if (dName === term) return true;
                     if (sampleDetails && sampleDetails[d.name]) {
                         return Object.values(sampleDetails[d.name]).some(v => 
                             v !== null && v !== undefined && String(v).toLowerCase() === term
                         );
                     }
                     return false;
                });
                if (isMatch) return 4;
            }
            return 2;
        },
        radiusMinPixels: 1.2,
        radiusUnits: 'pixels',
        coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
        pickable: true,
        modelMatrix:null,
        viewId,
        updateTriggers: {
          getFillColor: [populationFilter.colorBy, populationFilter.enabledValues],
          getLineColor: [searchTerm, searchTags],
          getLineWidth: [searchTerm, searchTags],
          getRadius: [searchTerm, searchTags],
          data: [bin.modelMatrix, bin.path],
          
        },
      }),
    ];

    if (lineagePaths && lineagePaths[bin.global_index]) {
       const lineageData = lineagePaths[bin.global_index];
       layers.push(
           new PathLayer({
               id: `${this.props.id}-lineage-path-${bin.global_index}`,
               data: lineageData,
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
               getColor: [255, 0, 0, 255],
               getWidth: 3,
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
          const m = bin.modelMatrix;
          const translate_position = m[12];
          const scale_position = m[0];
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
        modelMatrix:null,
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

    layers.push(new IconLayer({
        id: `${this.props.id}-icons-${bin.global_index}`,
        data: bin.path.filter(d => d?.mutations !== undefined && d?.mutations !== null),
        getPosition: d => {
          const m = bin.modelMatrix;
          const translate_position = m[12];
          const scale_position = m[0];
          const position = [d.position[0] * scale_position + translate_position, d.position[1]];
          return position;
        },
        getIcon: () => 'marker',
        modelMatrix:bin.modelMatrix,
        getColor: [255, 0, 0],
        viewId,
        getSize: 0.01,     
        sizeUnits: 'common',
        iconAtlas: '/X.png',
        iconMapping: {
          marker: {x: 0, y: 0, width: 128, height: 128, mask: true}
        },
        updateTriggers: {
          data: [bin.path, bin.modelMatrix],
        },
      }));

    return layers;
  }
}