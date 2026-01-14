import { CompositeLayer, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';

/**
 * PostOrderCompositeLayer - Tree rendering using pre-computed render data.
 *
 * SIMPLIFIED VERSION: Only uses renderData from worker.
 * All computation (modelMatrix transforms, node grouping) happens in worker.
 * Layer just passes typed arrays to deck.gl sublayers.
 *
 * Expected renderData format:
 * - pathPositions: Float64Array (L-shaped edge coordinates)
 * - pathStartIndices: Array (indices for PathLayer)
 * - tipPositions: Float64Array (tip node coordinates)
 * - tipColors: Uint8Array (RGBA per tip)
 * - tipData: Array of {node_id, tree_idx, position} for picking
 * - edgeCount: number
 * - tipCount: number
 */
export default class PostOrderCompositeLayer extends CompositeLayer {
    static layerName = 'PostOrderCompositeLayer';
    static defaultProps = {
        renderData: null,     // Pre-computed render data from worker
        edgeColor: [100, 100, 100, 255],
        edgeWidth: 1,
        tipRadius: 2,
        // Search highlighting props (computed in worker)
        highlightStrokeColor: [255, 165, 0, 255],
        highlightStrokeWidth: 2,
        highlightRadius: 5,
        lineageWidth: 1.5,
        lineageColor: [255, 0, 0, 200],
    };

    updateState({ props, oldProps }) {
        // Only update when renderData changes
        if (props.renderData !== oldProps.renderData) {
            this.setState({
                processedData: props.renderData
            });
        }
    }

    renderLayers() {
        const { processedData } = this.state;
        if (!processedData || !processedData.pathPositions || processedData.edgeCount === 0) {
            return null;
        }

        const { pathPositions, pathStartIndices, tipPositions, tipColors, edgeCount, tipCount, tipData, highlightData, lineageData } = processedData;
        const { edgeColor, edgeWidth, tipRadius, highlightStrokeColor, highlightStrokeWidth, highlightRadius, lineageWidth, lineageColor } = this.props;

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
                modelMatrix: null,
                viewId: "ortho",
                zOffset: 1,
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
                id: `${this.props.id}-nodes`,
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
        if (tipData && tipData.length > 0) {
            layers.push(new ScatterplotLayer({
                id: `${this.props.id}-tips-pickable`,
                data: tipData,
                getPosition: d => d.position,
                getFillColor: [0, 0, 0, 0],
                getRadius: tipRadius + 4,
                radiusUnits: 'pixels',
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                pickable: true
            }));
        }

        // Lineage paths
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

        // Highlighted nodes
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
