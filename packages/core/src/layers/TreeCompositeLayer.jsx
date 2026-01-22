import { CompositeLayer, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';

/**
 * TreeCompositeLayer - Renders trees using pre-computed render data.
 *
 * Consumes typed arrays from useRenderData hook:
 * - pathPositions: Float64Array of L-shaped edge coordinates
 * - pathStartIndices: Array of indices for PathLayer binary format
 * - tipPositions: Float64Array of tip node coordinates
 * - tipColors: Uint8Array of RGBA per tip
 * - tipData: Array of { node_id, tree_idx, position } for picking
 *
 * All transforms (modelMatrix) are pre-applied in the worker.
 * Layer just passes typed arrays to deck.gl sublayers.
 */
export class TreeCompositeLayer extends CompositeLayer {
  static layerName = 'TreeCompositeLayer';
  static defaultProps = {
    renderData: null,     // Pre-computed render data from useRenderData
    edgeColor: [100, 100, 100, 255],
    edgeWidth: 1,
    tipRadius: 2,
    // Highlighting props
    highlightStrokeColor: [255, 165, 0, 255],
    highlightStrokeWidth: 2,
    highlightRadius: 5,
    // Lineage props
    lineageWidth: 1.5,
    lineageColor: [255, 0, 0, 200],
    // Interaction
    pickable: false,
    onTipClick: null,
    onTipHover: null,
    onEdgeClick: null,
    onEdgeHover: null,
    hoveredEdgeIndex: null,
  };

  updateState({ props, oldProps }) {
    if (props.renderData !== oldProps.renderData) {
      this.setState({
        processedData: props.renderData
      });
    }
  }

  renderLayers() {
    const { processedData } = this.state;

    if (!processedData || !processedData.pathPositions || processedData.pathPositions.length === 0) {
      return null;
    }

    const {
      pathPositions,
      pathStartIndices,
      tipPositions,
      tipColors,
      edgeData,
      edgeCount,
      tipCount,
      tipData,
      highlightData,
      lineageData
    } = processedData;

    const {
      edgeColor,
      edgeWidth,
      tipRadius,
      highlightStrokeColor,
      highlightStrokeWidth,
      highlightRadius,
      lineageWidth,
      lineageColor,
      pickable,
      onTipClick,
      onTipHover,
      onEdgeClick,
      onEdgeHover,
      hoveredEdgeIndex
    } = this.props;

    const layers = [];

    // Edge paths using binary data format
    if (edgeCount > 0) {
      const edgeBinaryData = {
        length: pathStartIndices.length - 1,
        startIndices: new Uint32Array(pathStartIndices),
        attributes: {
          getPath: { value: pathPositions, size: 2 }
        }
      };

      layers.push(new PathLayer({
        id: `${this.props.id}-edges`,
        data: edgeBinaryData,
        getColor: edgeColor,
        getWidth: edgeWidth,
        fp64: true,
        widthUnits: 'pixels',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        parameters: { depthTest: false },
        pickable: false
      }));

      // Hover highlight (render only the hovered edge, thicker)
      if (hoveredEdgeIndex != null && hoveredEdgeIndex >= 0 && hoveredEdgeIndex < pathStartIndices.length - 1) {
        const start = pathStartIndices[hoveredEdgeIndex] * 2;
        const end = pathStartIndices[hoveredEdgeIndex + 1] * 2;
        const segment = pathPositions.slice(start, end);

        if (segment.length >= 4) {
          const highlightBinary = {
            length: 1,
            startIndices: new Uint32Array([0, segment.length / 2]),
            attributes: {
              getPath: { value: segment, size: 2 }
            }
          };

          layers.push(new PathLayer({
            id: `${this.props.id}-edge-hover-highlight`,
            data: highlightBinary,
            getColor: edgeColor,
            getWidth: Math.max(edgeWidth + 2, 3),
            fp64: true,
            widthUnits: 'pixels',
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            parameters: { depthTest: false },
            pickable: false
          }));
        }
      }

      // Pickable edge overlay (invisible, thicker for easier hover/click)
      if (pickable && edgeData && edgeData.length > 0) {
        layers.push(new PathLayer({
          id: `${this.props.id}-edges-pickable`,
          data: edgeBinaryData,
          getColor: [0, 0, 0, 0],
          getWidth: Math.max(edgeWidth + 6, 8),
          fp64: true,
          widthUnits: 'pixels',
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          parameters: { depthTest: false },
          pickable: true,
          onHover: (info, event) => {
            const idx = info?.index;
            const edge = (idx != null && idx >= 0) ? edgeData?.[idx] : null;
            onEdgeHover?.(edge, info, event);
          },
          onClick: (info, event) => {
            const idx = info?.index;
            const edge = (idx != null && idx >= 0) ? edgeData?.[idx] : null;
            onEdgeClick?.(edge, info, event);
          }
        }));
      }
    }

    // Tip nodes using binary data format with per-tip colors
    if (tipCount > 0) {
      layers.push(new ScatterplotLayer({
        id: `${this.props.id}-tips`,
        data: {
          length: tipCount,
          attributes: {
            getPosition: { value: tipPositions, size: 2 },
            getFillColor: { value: tipColors, size: 4 }
          }
        },
        fp64: true,
        getRadius: tipRadius,
        radiusUnits: 'pixels',
        stroked: false,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        pickable: false
      }));
    }

    // Pickable tip layer (invisible overlay for clicking)
    if (pickable && tipData && tipData.length > 0) {
      layers.push(new ScatterplotLayer({
        id: `${this.props.id}-tips-pickable`,
        data: tipData,
        getPosition: d => d.position,
        getFillColor: [0, 0, 0, 0],
        getRadius: tipRadius + 4,
        radiusUnits: 'pixels',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        pickable: true,
        onHover: (info, event) => {
          onTipHover?.(info?.object || null, info, event);
        },
        onClick: (info, event) => {
          onTipClick?.(info?.object || null, info, event);
        }
      }));
    }

    // Lineage paths (optional)
    if (lineageData && lineageData.length > 0) {
      layers.push(new PathLayer({
        id: `${this.props.id}-lineage`,
        data: lineageData,
        getPath: d => d.path,
        getColor: d => d.color || lineageColor,
        getWidth: lineageWidth,
        widthUnits: 'pixels',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        parameters: { depthTest: false },
        pickable: false
      }));
    }

    // Highlighted nodes (optional)
    if (highlightData && highlightData.length > 0) {
      layers.push(new ScatterplotLayer({
        id: `${this.props.id}-highlights`,
        data: highlightData,
        getPosition: d => d.position,
        getFillColor: d => d.color ? [...d.color.slice(0, 3), 200] : [255, 200, 0, 200],
        getLineColor: highlightStrokeColor,
        getRadius: highlightRadius,
        radiusUnits: 'pixels',
        filled: true,
        stroked: true,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: highlightStrokeWidth,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        parameters: { depthTest: false },
        fp64: true,
        pickable: false
      }));
    }

    return layers;
  }
}
