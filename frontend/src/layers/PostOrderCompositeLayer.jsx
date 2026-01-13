import { CompositeLayer, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';

/**
 * PostOrderCompositeLayer - Tree rendering using post-order traversal arrays.
 *
 * Receives post-order node data from backend with pre-computed x,y coordinates.
 * Backend handles coordinate computation and sparsification, frontend uses
 * coordinates directly for rendering.
 *
 * Data format from backend (PyArrow):
 * - node_id: int32
 * - parent_id: int32 (-1 for roots)
 * - time: float64
 * - is_tip: bool
 * - tree_idx: int32 (which tree this node belongs to)
 * - x: float32 (time-based coordinate [0,1], root=0, tips=1)
 * - y: float32 (genealogy-based coordinate [0,1])
 *
 * Plus metadata:
 * - global_min_time, global_max_time
 */
export default class PostOrderCompositeLayer extends CompositeLayer {
    static layerName = 'PostOrderCompositeLayer';
    static defaultProps = {
        bins: null,
        postorderData: null,  // {node_id, parent_id, time, is_tip, tree_idx} arrays + metadata
        tsconfig: null,
        minNodeTime: 0,
        maxNodeTime: 1,
        globalBpPerUnit: 1,
        edgeColor: [100, 100, 100, 255],
        tipColor: [150, 150, 150, 255],  // Fallback color
        edgeWidth: 1,
        tipRadius: 2,
        // Metadata-based coloring props
        metadataArrays: null,     // {key: {uniqueValues, indices, nodeIdToIdx}}
        metadataColors: null,     // {key: {value: [r,g,b,a]}}
        populationFilter: null,   // {colorBy, enabledValues}
        // Search highlighting props
        highlightedNodes: null,   // {tree_idx: [{node_id, name}]}
        lineagePaths: null,       // {tree_idx: [{path_node_ids: [int], color}]}
        // Highlight styling
        highlightStrokeColor: [255, 165, 0, 255],  // Orange outline
        highlightStrokeWidth: 2,
        highlightRadius: 5,
        lineageWidth: 1.5,
        lineageColor: [255, 0, 0, 200],  // Red lineage paths
    };

    updateState({ props, oldProps, changeFlags }) {
        const filterChanged =
            props.populationFilter?.colorBy !== oldProps.populationFilter?.colorBy ||
            JSON.stringify(props.populationFilter?.enabledValues) !==
                JSON.stringify(oldProps.populationFilter?.enabledValues);

        const colorsChanged = props.metadataColors !== oldProps.metadataColors;
        const arraysChanged = props.metadataArrays !== oldProps.metadataArrays;
        const highlightsChanged = props.highlightedNodes !== oldProps.highlightedNodes;
        const lineagesChanged = props.lineagePaths !== oldProps.lineagePaths;

        if (changeFlags.dataChanged ||
            props.bins !== oldProps.bins ||
            props.postorderData !== oldProps.postorderData ||
            filterChanged || colorsChanged || arraysChanged ||
            highlightsChanged || lineagesChanged) {

            this.setState({
                processedData: this.processPostorderData(props)
            });
        }
    }

    /**
     * Get the color for a tip node based on metadata.
     * Uses O(1) lookup via metadataArrays.
     */
    getTipColor(nodeId, props) {
        const { metadataArrays, metadataColors, populationFilter, tipColor } = props;
        const colorBy = populationFilter?.colorBy;

        if (!colorBy || !metadataArrays?.[colorBy] || !metadataColors?.[colorBy]) {
            return tipColor;
        }

        const { uniqueValues, indices, nodeIdToIdx } = metadataArrays[colorBy];
        const idx = nodeIdToIdx?.get(nodeId);
        if (idx === undefined) return tipColor;

        const valueIdx = indices[idx];
        const value = uniqueValues[valueIdx];

        // Check if value is enabled in filter
        if (!populationFilter.enabledValues?.includes(value)) {
            return [150, 150, 150, 100];  // Dimmed for disabled values
        }

        const color = metadataColors[colorBy][value];
        return color ? [...color.slice(0, 3), 200] : tipColor;
    }

    /**
     * Group nodes by tree_idx for efficient lookup.
     * Includes pre-computed x,y coordinates from backend.
     */
    groupNodesByTree(postorderData) {
        const { node_id, parent_id, time, is_tip, tree_idx, x, y } = postorderData;

        if (!node_id || node_id.length === 0) {
            return new Map();
        }

        const treeMap = new Map();
        const hasCoords = x && x.length > 0 && y && y.length > 0;

        for (let i = 0; i < node_id.length; i++) {
            const treeIndex = tree_idx[i];

            if (!treeMap.has(treeIndex)) {
                treeMap.set(treeIndex, []);
            }

            treeMap.get(treeIndex).push({
                node_id: node_id[i],
                parent_id: parent_id[i],
                time: time[i],
                is_tip: is_tip[i],
                x: hasCoords ? x[i] : null,
                y: hasCoords ? y[i] : null
            });
        }

        return treeMap;
    }

    /**
     * Compute layout for a single tree using stack-based reconstruction.
     * Post-order guarantees children are processed before parents.
     *
     * @param {Array} postorderNodes - Nodes in post-order [{node_id, parent_id, time, is_tip}]
     * @param {number} minTime - Global min time for scaling
     * @param {number} maxTime - Global max time for scaling
     * @returns {Map} nodeMap with {node_id, x, y, children, is_tip}
     */
    computeTreeLayout(postorderNodes, minTime, maxTime) {
        const nodeMap = new Map();
        let tipCounter = 0;
        const timeRange = maxTime - minTime || 1;

        // Pass 1: Create all nodes
        for (const n of postorderNodes) {
            nodeMap.set(n.node_id, {
                node_id: n.node_id,
                time: n.time,
                is_tip: n.is_tip,
                parent_id: n.parent_id,
                children: [],
                y: null,
                // X coordinate: 0 at maxTime (root), 1 at minTime (tips)
                x: (maxTime - n.time) / timeRange
            });
        }

        // Pass 2: Build children arrays
        for (const n of postorderNodes) {
            if (n.parent_id !== -1) {
                const parent = nodeMap.get(n.parent_id);
                const child = nodeMap.get(n.node_id);
                if (parent && child) {
                    parent.children.push(child);
                }
            }
        }

        // Pass 2.5: Sort children at each node for consistent layout ordering
        for (const node of nodeMap.values()) {
            if (node.children.length > 1) {
                node.children.sort((a, b) => a.node_id - b.node_id);
            }
        }

        // Pass 3: Assign Y coordinates using iterative DFS from roots
        // This ensures tips in the same subtree get contiguous Y values (proper local genealogy)

        // Find roots (nodes with parent_id === -1)
        const roots = [];
        for (const n of postorderNodes) {
            if (n.parent_id === -1) {
                roots.push(nodeMap.get(n.node_id));
            }
        }
        roots.sort((a, b) => a.node_id - b.node_id);

        // Iterative post-order DFS to assign Y in proper subtree order
        // Uses explicit stack to avoid call stack overflow on deep trees
        const stack = [];

        // Push roots in reverse order so first root is processed first
        for (let i = roots.length - 1; i >= 0; i--) {
            stack.push({ node: roots[i], childIdx: 0 });
        }

        while (stack.length > 0) {
            const frame = stack[stack.length - 1];
            const node = frame.node;

            if (node.is_tip || frame.childIdx >= node.children.length) {
                // All children processed (or is tip) - assign Y and pop
                if (node.is_tip) {
                    node.y = tipCounter++;
                } else if (node.children.length > 0) {
                    const sumY = node.children.reduce((sum, c) => sum + c.y, 0);
                    node.y = sumY / node.children.length;
                } else {
                    // Edge case: internal node with no children (shouldn't happen)
                    node.y = tipCounter++;
                }
                stack.pop();
            } else {
                // Push next child to process
                const child = node.children[frame.childIdx];
                frame.childIdx++;
                stack.push({ node: child, childIdx: 0 });
            }
        }

        // Pass 4: Normalize Y to [0, 1]
        const maxY = Math.max(1, tipCounter - 1);
        for (const node of nodeMap.values()) {
            node.y = node.y / maxY;
        }

        return nodeMap;
    }

    /**
     * Process post-order data into flat typed arrays for rendering.
     * Now includes per-tip color arrays for metadata-based coloring.
     * Also computes highlight positions and lineage paths.
     */
    processPostorderData(props) {
        const { bins, postorderData, minNodeTime, maxNodeTime, highlightedNodes, lineagePaths } = props;

        if (!bins || bins.size === 0 || !postorderData) {
            return { pathPositions: null, tipPositions: null, tipColors: null, tipData: [], edgeCount: 0, tipCount: 0, highlightData: [], lineageData: [] };
        }

        const { node_id, parent_id, time, is_tip, tree_idx } = postorderData;

        if (!node_id || node_id.length === 0) {
            return { pathPositions: null, tipPositions: null, tipColors: null, tipData: [], edgeCount: 0, tipCount: 0, highlightData: [], lineageData: [] };
        }

        // Group nodes by tree
        const treeNodesMap = this.groupNodesByTree(postorderData);

        // Calculate exact buffer size for visible trees only
        // (Using average was causing buffer overflow for large trees, silently dropping edges)
        let totalVisibleNodes = 0;
        for (const [key, bin] of bins) {
            if (!bin.visible) continue;
            const treeNodes = treeNodesMap.get(bin.global_index);
            if (treeNodes) totalVisibleNodes += treeNodes.length;
        }
        // Add 10% buffer for safety
        const bufferMultiplier = 1.1;
        const maxPathPositions = Math.ceil(totalVisibleNodes * 6 * bufferMultiplier);  // 6 floats per L-shape
        const maxTipPositions = Math.ceil(totalVisibleNodes * 2 * bufferMultiplier);   // 2 floats per tip
        const maxTipColors = Math.ceil(totalVisibleNodes * 4 * bufferMultiplier);      // 4 bytes RGBA per tip

        // Use Float64Array to preserve precision for large coordinates
        // (Float32 loses precision when translateX is ~274727 and differences are ~0.001)
        const pathPositions = new Float64Array(maxPathPositions);
        const tipPositions = new Float64Array(maxTipPositions);
        const tipColors = new Uint8Array(maxTipColors);
        const tipData = [];  // Object array for pickable tips
        const pathStartIndices = [0];

        let pathOffset = 0;
        let tipOffset = 0;
        let tipColorOffset = 0;
        let edgeCount = 0;

        // Store node positions for highlight and lineage computation
        // Map: treeIdx -> Map(nodeId -> {worldX, worldY})
        const nodePositionsByTree = new Map();

        for (const [key, bin] of bins) {
            if (!bin.visible) continue;

            const treeIdx = bin.global_index;

            // Get nodes for this tree
            const treeNodes = treeNodesMap.get(treeIdx);
            if (!treeNodes || treeNodes.length === 0) continue;

            // Use backend coordinates if available, otherwise compute locally (fallback)
            let nodeMap;
            const hasBackendCoords = treeNodes[0]?.x !== null && treeNodes[0]?.y !== null;

            if (hasBackendCoords) {
                // Use pre-computed coordinates from backend (no recomputation needed)
                nodeMap = new Map();
                for (const n of treeNodes) {
                    nodeMap.set(n.node_id, {
                        node_id: n.node_id,
                        x: n.x,  // Backend x: time-based [0,1], root=0, tips=1
                        y: n.y,  // Backend y: genealogy-based [0,1]
                        is_tip: n.is_tip,
                        parent_id: n.parent_id,
                        children: []
                    });
                }
                // Build children arrays for edge traversal
                for (const n of treeNodes) {
                    if (n.parent_id !== -1) {
                        const parent = nodeMap.get(n.parent_id);
                        const child = nodeMap.get(n.node_id);
                        if (parent && child) {
                            parent.children.push(child);
                        }
                    }
                }
            } else {
                // Fallback: compute layout locally (for backwards compatibility)
                nodeMap = this.computeTreeLayout(treeNodes, minNodeTime, maxNodeTime);
            }

            if (nodeMap.size === 0) continue;

            const m = bin.modelMatrix;
            const scaleX = m[0];
            const translateX = m[12];

            // Store node positions for this tree (for highlights and lineages)
            const positionsMap = new Map();
            for (const node of nodeMap.values()) {
                const worldX = node.y * scaleX + translateX;
                const worldY = node.x;
                positionsMap.set(node.node_id, { worldX, worldY, color: this.getTipColor(node.node_id, props) });
            }
            nodePositionsByTree.set(treeIdx, positionsMap);

            // Generate L-shaped edges
            for (const node of nodeMap.values()) {
                if (node.children.length === 0) continue;

                const py = node.y;  // Parent Y (normalized [0, 1])
                const pt = node.x;  // Parent X (time, already scaled)

                for (const childNode of node.children) {
                    const cy = childNode.y;
                    const ct = childNode.x;

                    // Ensure we have space
                    if (pathOffset + 6 > pathPositions.length) {
                        continue;  // Skip if overflow (shouldn't happen with good estimates)
                    }

                    // L-shape path: parent -> horizontal to child y -> down to child
                    // World X = y * scaleX + translateX (y is the horizontal spread)
                    // World Y = t (time is the vertical axis)
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

            // Collect tip positions and colors
            for (const node of nodeMap.values()) {
                if (node.is_tip) {
                    if (tipOffset + 2 > tipPositions.length) continue;
                    if (tipColorOffset + 4 > tipColors.length) continue;

                    // Position
                    const tipX = node.y * scaleX + translateX;
                    const tipY = node.x;
                    tipPositions[tipOffset++] = tipX;
                    tipPositions[tipOffset++] = tipY;

                    // Color - use metadata-based lookup
                    const color = this.getTipColor(node.node_id, props);
                    tipColors[tipColorOffset++] = color[0];
                    tipColors[tipColorOffset++] = color[1];
                    tipColors[tipColorOffset++] = color[2];
                    tipColors[tipColorOffset++] = color[3] ?? 200;

                    // Add object for pickable layer
                    tipData.push({
                        node_id: node.node_id,
                        tree_idx: treeIdx,
                        position: [tipX, tipY]
                    });
                }
            }
        }

        // Process highlighted nodes (skip if null/undefined or empty)
        const highlightData = [];
        if (highlightedNodes && typeof highlightedNodes === 'object' && Object.keys(highlightedNodes).length > 0) {
            for (const [treeIdxStr, nodes] of Object.entries(highlightedNodes)) {
                const treeIdx = parseInt(treeIdxStr, 10);
                const positionsMap = nodePositionsByTree.get(treeIdx);
                if (!positionsMap) continue;

                for (const node of nodes) {
                    const pos = positionsMap.get(node.node_id);
                    if (pos) {
                        highlightData.push({
                            position: [pos.worldX, pos.worldY],
                            name: node.name,
                            color: pos.color
                        });
                    }
                }
            }
        }

        // Process lineage paths (skip if null/undefined or empty)
        const lineageData = [];
        if (lineagePaths && typeof lineagePaths === 'object' && Object.keys(lineagePaths).length > 0) {
            for (const [treeIdxStr, lineages] of Object.entries(lineagePaths)) {
                const treeIdx = parseInt(treeIdxStr, 10);
                const positionsMap = nodePositionsByTree.get(treeIdx);
                if (!positionsMap) continue;

                for (const lineage of lineages) {
                    const pathNodeIds = lineage.path_node_ids;
                    if (!pathNodeIds || pathNodeIds.length < 2) continue;

                    // Get color from the seed node (first node in path, which is the sample)
                    // This ensures lineage color matches the highlighted node's metadata color
                    const seedNodeId = pathNodeIds[0];
                    const seedPos = positionsMap.get(seedNodeId);
                    const lineageColor = seedPos?.color || lineage.color || props.lineageColor;

                    // Build L-shaped path segments between nodes (like tree edges)
                    const pathCoords = [];
                    for (let i = 0; i < pathNodeIds.length - 1; i++) {
                        const fromPos = positionsMap.get(pathNodeIds[i]);
                        const toPos = positionsMap.get(pathNodeIds[i + 1]);
                        if (fromPos && toPos) {
                            // L-shape: from -> horizontal -> vertical to "to"
                            if (pathCoords.length === 0) {
                                pathCoords.push([fromPos.worldX, fromPos.worldY]);
                            }
                            // Horizontal segment to parent's X, then vertical
                            pathCoords.push([fromPos.worldX, toPos.worldY]);
                            pathCoords.push([toPos.worldX, toPos.worldY]);
                        }
                    }

                    if (pathCoords.length >= 2) {
                        lineageData.push({
                            path: pathCoords,
                            color: lineageColor
                        });
                    }
                }
            }
        }

        return {
            pathPositions: pathPositions.subarray(0, pathOffset),
            pathStartIndices,
            tipPositions: tipPositions.subarray(0, tipOffset),
            tipColors: tipColors.subarray(0, tipColorOffset),
            edgeCount,
            tipCount: tipOffset / 2,
            tipData,
            highlightData,
            lineageData
        };
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
                // _pathType: 'open',
                modelMatrix: null,
                viewId: "ortho",
                zOffset: 1,
                getColor: edgeColor,
                getWidth: edgeWidth,
                fp64: true,
                widthUnits: 'pixels',
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                parameters: { depthTest: false },
                pickable: false  // Disable picking for performance
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
                        getFillColor: { value: tipColors, size: 4 }  // Binary RGBA per tip
                    }
                },
                fp64: true,
                getRadius: tipRadius,
                radiusUnits: 'pixels',
                stroked: false,
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                pickable: false  // Disable picking for performance
            }));
        }

        // Pickable tip layer (invisible overlay for clicking)
        if (tipData && tipData.length > 0) {
            layers.push(new ScatterplotLayer({
                id: `${this.props.id}-tips-pickable`,
                data: tipData,
                getPosition: d => d.position,
                getFillColor: [0, 0, 0, 0],  // Fully transparent
                getRadius: tipRadius + 4,    // Slightly larger hit area
                radiusUnits: 'pixels',
                coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
                pickable: true
            }));
        }

        // Lineage paths (rendered before highlights so highlights appear on top)
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

        // Highlighted nodes with outline/stroke style
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
