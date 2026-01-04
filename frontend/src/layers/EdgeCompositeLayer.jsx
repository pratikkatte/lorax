import { CompositeLayer, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';

/**
 * EdgeCompositeLayer - Optimized for rendering millions of tree edges.
 *
 * Uses pre-computed layout from backend (y,x coordinates) and typed arrays
 * for efficient memory usage and rendering performance.
 *
 * Layout data format from backend (per tree):
 * - edges: Float32Array [y1,x1, y2,x2, y3,x3, ...] - L-shaped paths
 * - tips: Float32Array [y, x, node_id, ...] - tip node positions
 */
export default class EdgeCompositeLayer extends CompositeLayer {
    static layerName = 'EdgeCompositeLayer';
    static defaultProps = {
        bins: null,
        layoutData: null,  // Map<tree_index, {edges, tips, edgeCount, tipCount}>
        nodeTimes: null,
        globalMinTime: 0,
        globalMaxTime: 1,
        globalBpPerUnit: 1,
        edgeColor: [100, 100, 100, 255],
        tipColor: [255, 0, 0, 255],
        edgeWidth: 1,
        tipRadius: 2
    };

    updateState({ props, oldProps, changeFlags }) {
        if (changeFlags.dataChanged ||
            props.bins !== oldProps.bins ||
            props.layoutData !== oldProps.layoutData) {

            this.setState({
                processedData: this.processDataOptimized(props)
            });
        }
    }

    /**
     * Process pre-computed layout data into flat typed arrays for rendering.
     * No tree construction needed - backend already computed coordinates.
     */
    processDataOptimized(props) {
        const { bins, layoutData } = props;

        if (!bins || bins.size === 0 || !layoutData || layoutData.size === 0) {
            return { pathPositions: null, tipPositions: null, edgeCount: 0, tipCount: 0 };
        }

        // Count total edges and tips across all visible bins
        let totalEdgeVertices = 0;
        let totalTips = 0;

        for (const [key, bin] of bins) {
            if (!bin.visible) continue;

            const treeIdx = bin.global_index;
            const treeLayout = layoutData.get(treeIdx);
            if (treeLayout) {
                // Each edge has 3 vertices (L-shape), 2 coords each = 6 floats per edge
                totalEdgeVertices += treeLayout.edgeCount * 3;
                totalTips += treeLayout.tipCount;
            }
        }

        if (totalEdgeVertices === 0) {
            return { pathPositions: null, tipPositions: null, edgeCount: 0, tipCount: 0 };
        }

        // Allocate flat typed arrays
        const pathPositions = new Float32Array(totalEdgeVertices * 2);
        const tipPositions = new Float32Array(totalTips * 2);
        const pathStartIndices = [0];

        let pathOffset = 0;
        let tipOffset = 0;
        let edgeCount = 0;

        for (const [key, bin] of bins) {
            if (!bin.visible) continue;

            const treeIdx = bin.global_index;
            const treeLayout = layoutData.get(treeIdx);
            if (!treeLayout || !treeLayout.edges) continue;

            const m = bin.modelMatrix;
            const scaleX = m[0];
            const translateX = m[12];

            const edges = treeLayout.edges;
            const tips = treeLayout.tips;

            // Process edges: each edge = 6 floats (y1,x1, y2,x2, y3,x3)
            for (let i = 0; i < edges.length; i += 6) {
                const y1 = edges[i], x1 = edges[i + 1];
                const y2 = edges[i + 2], x2 = edges[i + 3];
                const y3 = edges[i + 4], x3 = edges[i + 5];

                // Transform Y (horizontal in our coord system) and keep X (time/vertical)
                // deck.gl CARTESIAN: [x, y] where x is horizontal, y is vertical
                pathPositions[pathOffset++] = y1 * scaleX + translateX;
                pathPositions[pathOffset++] = x1;
                pathPositions[pathOffset++] = y2 * scaleX + translateX;
                pathPositions[pathOffset++] = x2;
                pathPositions[pathOffset++] = y3 * scaleX + translateX;
                pathPositions[pathOffset++] = x3;

                pathStartIndices.push(pathOffset / 2);
                edgeCount++;
            }

            // Process tips: each tip = 3 floats (y, x, node_id)
            if (tips) {
                for (let i = 0; i < tips.length; i += 3) {
                    const y = tips[i], x = tips[i + 1];
                    // node_id at tips[i + 2] - not used for rendering but available for picking

                    tipPositions[tipOffset++] = y * scaleX + translateX;
                    tipPositions[tipOffset++] = x;
                }
            }
        }

        return {
            pathPositions: pathPositions.subarray(0, pathOffset),
            pathStartIndices,
            tipPositions: tipPositions.subarray(0, tipOffset),
            edgeCount,
            tipCount: tipOffset / 2
        };
    }

    renderLayers() {
        const { processedData } = this.state;
        if (!processedData || !processedData.pathPositions || processedData.edgeCount === 0) {
            return null;
        }

        const { pathPositions, pathStartIndices, tipPositions, edgeCount, tipCount } = processedData;
        const { edgeColor, tipColor, edgeWidth, tipRadius } = this.props;

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
                _pathType: 'open',
                getColor: edgeColor,
                getWidth: edgeWidth,
                widthUnits: 'pixels',
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                parameters: { depthTest: false },
                pickable: false  // Disable picking for performance with millions of edges
            }));
        }

        // Tip nodes using binary data format
        if (tipCount > 0) {
            layers.push(new ScatterplotLayer({
                id: `${this.props.id}-nodes`,
                data: {
                    length: tipCount,
                    attributes: {
                        getPosition: { value: tipPositions, size: 2 }
                    }
                },
                getFillColor: tipColor,
                getRadius: tipRadius,
                radiusUnits: 'pixels',
                stroked: false,
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                pickable: false  // Disable picking for performance
            }));
        }

        return layers;
    }
}
