import { CompositeLayer, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { filterActiveEdges, processTreeFromEdges } from '../webworkers/modules/edgeTreeBuilder.js';

/**
 * EdgeCompositeLayer - Optimized for rendering millions of tree edges.
 *
 * Computes tree layout from raw edge data using edgeTreeBuilder.
 * Backend sends raw edges (left, right, parent, child) + node_times.
 * This layer filters edges per tree, builds tree structure, and computes layout.
 *
 * Layout data format from backend:
 * - left, right, parent, child: arrays of edge data
 * - node_times: {node_id: time} mapping
 */
export default class EdgeCompositeLayer extends CompositeLayer {
    static layerName = 'EdgeCompositeLayer';
    static defaultProps = {
        bins: null,
        layoutData: null,  // {left, right, parent, child, node_times}
        tsconfig: null,    // For intervals and genome_length
        minNodeTime: 0,
        maxNodeTime: 1,
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
     * Process raw edge data into flat typed arrays for rendering.
     * Uses edgeTreeBuilder to compute layout per tree from raw edges.
     */
    processDataOptimized(props) {
        const { bins, layoutData, tsconfig, minNodeTime, maxNodeTime } = props;

        if (!bins || bins.size === 0 || !layoutData) {
            return { pathPositions: null, tipPositions: null, edgeCount: 0, tipCount: 0 };
        }

        const { left, right, parent, child, node_times } = layoutData;

        if (!left || left.length === 0 || !node_times) {
            return { pathPositions: null, tipPositions: null, edgeCount: 0, tipCount: 0 };
        }

        const intervals = tsconfig?.intervals || [];
        const genome_length = tsconfig?.genome_length || 0;

        // Time range for Y coordinate transformation
        // Y=0 at maxTime (root), Y=1 at minTime (tips)
        const timeRange = maxNodeTime - minNodeTime || 1;

        // Estimate sizes for pre-allocation
        const estimatedEdgesPerTree = Math.ceil(left.length / Math.max(1, bins.size)) * 3;
        const estimatedTipsPerTree = 100;
        const visibleBinCount = [...bins.values()].filter(b => b.visible).length;

        const maxPathPositions = visibleBinCount * estimatedEdgesPerTree * 6;
        const maxTipPositions = visibleBinCount * estimatedTipsPerTree * 2;

        const pathPositions = new Float32Array(maxPathPositions);
        const tipPositions = new Float32Array(maxTipPositions);
        const pathStartIndices = [0];

        let pathOffset = 0;
        let tipOffset = 0;
        let edgeCount = 0;

        for (const [key, bin] of bins) {
            if (!bin.visible) continue;

            const treeIdx = bin.global_index;
            const treeStart = intervals[treeIdx];
            const treeEnd = intervals[treeIdx + 1] ?? genome_length;

            if (treeStart === undefined) continue;

            // Filter edges active in this tree's interval
            const activeEdges = filterActiveEdges(layoutData, treeStart, treeEnd);

            if (activeEdges.parent.length === 0) continue;

            // Build tree and compute layout
            const tree = processTreeFromEdges(
                activeEdges,
                node_times,  // node_times is now an object {node_id: time}
                {},  // mutations - not needed for layout
                minNodeTime,
                maxNodeTime
            );

            if (!tree || !tree.nodes || tree.nodes.length === 0) continue;

            const m = bin.modelMatrix;
            const scaleX = m[0];
            const translateX = m[12];

            // Generate L-shaped edges from tree nodes
            for (const node of tree.nodes) {
                if (!node.child || node.child.length === 0) continue;

                const py = node.y;  // Normalized horizontal spread [0, 1]
                // Transform time to Y: maxTime->0, minTime->1 (inverted)
                const pt = (maxNodeTime - node.time) / timeRange;

                for (const childNode of node.child) {
                    const cy = childNode.y;
                    const ct = (maxNodeTime - childNode.time) / timeRange;

                    // Ensure we have space
                    if (pathOffset + 6 > pathPositions.length) {
                        // Need to grow - just skip for now (should rarely happen)
                        continue;
                    }

                    // L-shape path: parent -> horizontal to child x -> down to child
                    // X coord: horizontal position on genome (transformed with model matrix)
                    // Y coord: normalized time (0=maxTime/root, 1=minTime/tips)
                    pathPositions[pathOffset++] = py * scaleX + translateX;
                    pathPositions[pathOffset++] = pt;
                    pathPositions[pathOffset++] = cy * scaleX + translateX;
                    pathPositions[pathOffset++] = pt;
                    pathPositions[pathOffset++] = cy * scaleX + translateX;
                    pathPositions[pathOffset++] = ct;

                    pathStartIndices.push(pathOffset / 2);
                    edgeCount++;
                }
            }

            // Collect tip positions
            for (const node of tree.nodes) {
                if (node.is_tip) {
                    if (tipOffset + 2 > tipPositions.length) continue;

                    tipPositions[tipOffset++] = node.y * scaleX + translateX;
                    tipPositions[tipOffset++] = (maxNodeTime - node.time) / timeRange;
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
