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
  };

  updateState({ props, oldProps }) {
    // Only update when renderData changes
    if (props.renderData !== oldProps.renderData) {
      console.log('[TreeCompositeLayer] updateState - renderData changed:', {
        hasRenderData: !!props.renderData,
        edgeCount: props.renderData?.edgeCount,
        tipCount: props.renderData?.tipCount,
        pathPositionsLength: props.renderData?.pathPositions?.length
      });
      this.setState({
        processedData: props.renderData
      });
    }
  }

  renderLayers() {
    const { processedData } = this.state;
    console.log('[TreeCompositeLayer] renderLayers called:', {
      hasProcessedData: !!processedData,
      pathPositionsLength: processedData?.pathPositions?.length,
      edgeCount: processedData?.edgeCount,
      tipCount: processedData?.tipCount
    });

    if (!processedData || !processedData.pathPositions || processedData.pathPositions.length === 0) {
      console.log('[TreeCompositeLayer] No data to render - returning null');
      return null;
    }

    const {
      pathPositions,
      pathStartIndices,
      tipPositions,
      tipColors,
      edgeCount,
      tipCount,
      tipData,
      highlightData,
      lineageData
    } = processedData;

    // Log coordinate ranges for debugging - sample from entire array
    if (pathPositions.length > 0) {
      const xCoords = [];
      const yCoords = [];
      const step = Math.max(2, Math.floor(pathPositions.length / 200)); // Sample ~100 points
      for (let i = 0; i < pathPositions.length; i += step * 2) {
        xCoords.push(pathPositions[i]);
        yCoords.push(pathPositions[i + 1]);
      }
      console.log('[TreeCompositeLayer] Coordinate ranges (sampled from full array):', {
        xMin: Math.min(...xCoords),
        xMax: Math.max(...xCoords),
        yMin: Math.min(...yCoords),
        yMax: Math.max(...yCoords),
        sampleSize: xCoords.length,
        totalPoints: pathPositions.length / 2
      });
    }

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
      onTipHover
    } = this.props;

    const layers = [];

    // Edge paths using binary data format
    if (edgeCount > 0) {
      layers.push(new PathLayer({
        id: `${this.props.id}-edges`,
        data: {
          length: pathStartIndices.length - 1,
          startIndices: new Uint32Array(pathStartIndices),
          attributes: {
            getPath: { value: pathPositions, size: 2 }
          }
        },
        getColor: edgeColor,
        getWidth: edgeWidth,
        fp64: true,
        widthUnits: 'pixels',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        parameters: { depthTest: false },
        pickable: false
      }));
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
        onClick: onTipClick,
        onHover: onTipHover
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

    console.log('[TreeCompositeLayer] Returning', layers.length, 'sublayers:', layers.map(l => l.id));
    return layers;
  }
}
