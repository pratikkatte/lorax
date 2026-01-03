
import { CompositeLayer, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { filterActiveEdges } from '../webworkers/modules/edgeTreeBuilder';

export default class EdgeCompositeLayer extends CompositeLayer {
    static layerName = 'EdgeCompositeLayer';
    static defaultProps = {
        bins: null,
        edgesData: null,
        nodeTimes: null,
        globalMinTime: 0,
        globalMaxTime: 1,
        globalBpPerUnit: 1,
        minNodeTime: 0,
        maxNodeTime: 1
    };

    updateState({ props, oldProps, changeFlags }) {
        if (changeFlags.dataChanged ||
            props.bins !== oldProps.bins ||
            props.edgesData !== oldProps.edgesData ||
            props.nodeTimes !== oldProps.nodeTimes) {

            this.setState({
                processedData: this.processData(props)
            });
        }
    }

    processData(props) {
        const { bins, edgesData, nodeTimes } = props;

        if (!bins || !edgesData || !nodeTimes) return { allEdges: [], allNodes: [] };

        const allEdges = [];
        const allNodes = [];

        for (const [key, bin] of bins) {
            if (!bin.visible) continue;

            const treeStart = bin.s;
            const treeEnd = bin.e;
            const { parent, child } = filterActiveEdges(edgesData, treeStart, treeEnd);

            if (parent.length === 0) continue;

            // Build children adjacency map: parent -> [children]
            const childrenMap = new Map();
            const parentMap = new Map(); // child -> parent
            const nodeSet = new Set();

            for (let i = 0; i < parent.length; i++) {
                const p = parent[i];
                const c = child[i];
                nodeSet.add(p);
                nodeSet.add(c);
                parentMap.set(c, p);
                if (!childrenMap.has(p)) childrenMap.set(p, []);
                childrenMap.get(p).push(c);
            }

            // Find root(s) - nodes that are parents but never children in this tree
            const childSet = new Set(child);
            const roots = [];
            for (const p of new Set(parent)) {
                if (!childSet.has(p)) roots.push(p);
            }

            if (roots.length === 0) continue;

            // Find min/max time for this tree's nodes only
            let minTime = Infinity;
            let maxTime = -Infinity;
            for (const nodeId of nodeSet) {
                const t = nodeTimes[nodeId];
                if (t < minTime) minTime = t;
                if (t > maxTime) maxTime = t;
            }
            const timeRange = maxTime - minTime || 1;

            // 4. Iterative post-order traversal to count tips and assign Y coordinates
            const tipCount = new Map();  // nodeId -> number of tips in subtree
            const nodeY = new Map();     // nodeId -> Y coordinate (0-1)

            // Post-order traversal using stack (no recursion)
            const stack = [];

            // Initialize stack with roots
            for (const root of roots) {
                stack.push({ node: root, phase: 'pre' });
            }

            const tips = [];

            while (stack.length > 0) {
                const { node, phase } = stack.pop();

                if (phase === 'pre') {
                    const children = childrenMap.get(node) || [];
                    if (children.length === 0) {
                        // Leaf node - count as 1 tip
                        tipCount.set(node, 1);
                        tips.push(node);
                    } else {
                        // Internal node - push back for post-processing, then push children
                        stack.push({ node, phase: 'post' });
                        // Sort children by time (younger first) for consistent layout
                        children.sort((a, b) => nodeTimes[a] - nodeTimes[b]);
                        for (let i = children.length - 1; i >= 0; i--) {
                            stack.push({ node: children[i], phase: 'pre' });
                        }
                    }
                } else {
                    // Post phase - aggregate tip counts from children
                    const children = childrenMap.get(node) || [];
                    let count = 0;
                    for (const c of children) {
                        count += tipCount.get(c) || 0;
                    }
                    tipCount.set(node, count);
                }
            }

            // 5. Assign Y coordinates to tips (spread evenly 0-1)
            const numTips = tips.length;
            for (let i = 0; i < tips.length; i++) {
                nodeY.set(tips[i], numTips > 1 ? i / (numTips - 1) : 0.5);
            }

            // 6. Assign Y coordinates to internal nodes (average of children)
            // BFS from tips up to roots
            const queue = [...tips];
            const processed = new Set(tips);

            while (queue.length > 0) {
                const node = queue.shift();
                const p = parentMap.get(node);

                if (p !== undefined && !processed.has(p)) {
                    const children = childrenMap.get(p) || [];
                    // Check if all children have Y coordinates
                    const allChildrenProcessed = children.every(c => nodeY.has(c));

                    if (allChildrenProcessed) {
                        // Internal node Y = average of children Y
                        let sumY = 0;
                        for (const c of children) {
                            sumY += nodeY.get(c);
                        }
                        nodeY.set(p, sumY / children.length);
                        processed.add(p);
                        queue.push(p);
                    } else {
                        // Re-queue this node to process later
                        queue.push(node);
                    }
                }
            }

            // 7. Generate edges with proper coordinates
            const m = bin.modelMatrix;
            const scale = m[0];
            const translate = m[12];
            const transform = (x, y) => [x * scale + translate, y];

            for (let i = 0; i < parent.length; i++) {
                const p = parent[i];
                const c = child[i];

                // X = normalized time (0 = tips/present, 1 = root/oldest)
                const pX = 1 - (nodeTimes[p] - minTime) / timeRange;
                const cX = 1 - (nodeTimes[c] - minTime) / timeRange;

                // Y = tip spread (from layout algorithm)
                const pY = nodeY.get(p) ?? 0.5;
                const cY = nodeY.get(c) ?? 0.5;

                // L-shaped path: vertical then horizontal (standard tree visualization)
                allEdges.push({
                    path: [
                        transform(pY, pX),  // parent position
                        transform(cY, pX),  // horizontal to child's Y at parent's X
                        transform(cY, cX)   // vertical down to child's X
                    ],
                    color: [100, 100, 100, 255]
                });
            }


            // 8. Add tip nodes
            for (const tip of tips) {
                const x = (nodeTimes[tip] - minTime) / timeRange;
                
                const y = nodeY.get(tip) ?? 1;
                allNodes.push({
                    position: transform(y, 1),
                    color: [255, 0, 0, 255],
                    radius: 2
                });
            }
        }

        return { allEdges, allNodes };
    }

    renderLayers() {
        const { processedData } = this.state;
        if (!processedData) return null;
        const { allEdges, allNodes } = processedData;

        return [
            new PathLayer({
                id: `${this.props.id}-edges`,
                data: allEdges,
                getPath: d => d.path,
                getColor: d => d.color,
                getWidth: 1,
                widthUnits: 'pixels',
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                parameters: { depthTest: false },
                pickable: true
            }),
            new ScatterplotLayer({
                id: `${this.props.id}-nodes`,
                data: allNodes,
                getPosition: d => d.position,
                getFillColor: d => d.color,
                getRadius: d => d.radius,
                radiusUnits: 'pixels',
                stroked: false,
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                pickable: true
            })
        ];
    }
}
