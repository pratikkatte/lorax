/**
 * Edge-based tree building utilities.
 * 
 * This module builds tree structures directly from tskit edge data,
 * replacing the need to parse newick strings.
 */

/**
 * Filter edges that are active within a specific tree's interval.
 * An edge is active if its span [left, right) contains the tree's interval.
 * 
 * @param {Object} edgesData - Full edges data {left, right, parent, child}
 * @param {number} treeStart - Start of tree interval (bp)
 * @param {number} treeEnd - End of tree interval (bp)
 * @returns {Object} Filtered edges {parent, child} arrays
 */
export function filterActiveEdges(edgesData, treeStart, treeEnd) {
    const { left, right, parent, child } = edgesData;
    const activeParent = [];
    const activeChild = [];

    for (let i = 0; i < left.length; i++) {
        // Edge is active if it spans across the tree interval
        // Edge [left[i], right[i]) is active at position x if left[i] <= x < right[i]
        // For a tree at [treeStart, treeEnd), we check if the edge covers treeStart
        if (left[i] <= treeStart && right[i] > treeStart) {
            activeParent.push(parent[i]);
            activeChild.push(child[i]);
        }
    }

    return { parent: activeParent, child: activeChild };
}

/**
 * Build tree node structure from parent-child edges.
 * 
 * @param {Object} activeEdges - {parent, child} arrays
 * @param {Array} nodeTimes - Array of node times indexed by node ID
 * @param {Object} mutationsByNode - {nodeId: [{position, mutation}, ...]}
 * @returns {Object} Tree with {nodes, roots} 
 */
export function constructTreeFromEdges(activeEdges, nodeTimes, mutationsByNode = {}) {
    const { parent, child } = activeEdges;
    const nodes = new Map();

    // Collect all unique node IDs from edges
    const allNodeIds = new Set([...parent, ...child]);

    // Create nodes with times
    for (const nodeId of allNodeIds) {
        const muts = mutationsByNode[nodeId];
        nodes.set(nodeId, {
            node_id: nodeId,
            name: String(nodeId),
            time: nodeTimes[nodeId] ?? 0,
            child: [],
            parent: null,
            mutations: muts ? muts.map(m => m.mutation) : null,
            num_tips: 0,
            is_tip: true, // Will be updated when children are added
        });
    }

    // Build parent-child relationships
    for (let i = 0; i < parent.length; i++) {
        const parentNode = nodes.get(parent[i]);
        const childNode = nodes.get(child[i]);
        if (parentNode && childNode) {
            childNode.parent = parentNode;
            parentNode.child.push(childNode);
            parentNode.is_tip = false;
        }
    }

    // Find roots (nodes without parent)
    const roots = [...nodes.values()].filter(n => !n.parent);

    return { nodes: [...nodes.values()], roots };
}

/**
 * Iteratively count tips for each node (ladderize preparation).
 * Uses explicit stack to avoid stack overflow on large trees.
 * @param {Object} root - Root node of tree
 */
function assignNumTips(root) {
    // Post-order traversal using explicit stack
    const stack = [];
    const visited = new Set();

    stack.push(root);

    while (stack.length > 0) {
        const node = stack[stack.length - 1];

        if (node.child.length === 0) {
            // Leaf node
            node.num_tips = 1;
            stack.pop();
            visited.add(node);
        } else {
            // Check if all children have been processed
            const allChildrenVisited = node.child.every(c => visited.has(c));

            if (allChildrenVisited) {
                // All children processed, compute num_tips
                node.num_tips = node.child.reduce((sum, c) => sum + c.num_tips, 0);
                stack.pop();
                visited.add(node);
            } else {
                // Push unvisited children onto stack
                for (const child of node.child) {
                    if (!visited.has(child)) {
                        stack.push(child);
                    }
                }
            }
        }
    }
}

/**
 * Iteratively sort children by num_tips (ladderize).
 * Uses BFS to process all nodes.
 * @param {Object} root - Root node of tree
 */
function sortWithNumTips(root) {
    const queue = [root];

    while (queue.length > 0) {
        const node = queue.shift();
        node.child.sort((a, b) => a.num_tips - b.num_tips);
        for (const child of node.child) {
            queue.push(child);
        }
    }
}

/**
 * Assign Y coordinates (tip ordering) after ladderizing.
 * Tips get spread along the Y axis (vertical spread).
 * Uses iterative post-order traversal to avoid stack overflow.
 * @param {Object} tree - Tree with roots
 * @returns {number} Current Y position counter
 */
function assignTipCoordinates(tree) {
    let tipCounter = 0;

    for (const root of tree.roots) {
        // Post-order traversal using explicit stack
        const stack = [];
        const visited = new Set();

        stack.push(root);

        while (stack.length > 0) {
            const node = stack[stack.length - 1];

            if (node.child.length === 0) {
                // Leaf node - assign tip position
                node.y = tipCounter++;
                stack.pop();
                visited.add(node);
            } else {
                // Check if all children have been processed
                const allChildrenVisited = node.child.every(c => visited.has(c));

                if (allChildrenVisited) {
                    // All children processed, compute average Y
                    const sumY = node.child.reduce((sum, c) => sum + c.y, 0);
                    node.y = sumY / node.child.length;
                    stack.pop();
                    visited.add(node);
                } else {
                    // Push unvisited children onto stack (in reverse for correct order)
                    for (let i = node.child.length - 1; i >= 0; i--) {
                        const child = node.child[i];
                        if (!visited.has(child)) {
                            stack.push(child);
                        }
                    }
                }
            }
        }
    }

    return tipCounter;
}

/**
 * Scale tree X coordinates based on global time range.
 * X = 0 at max time (root/oldest), X = 1 at min time (leaves/youngest).
 * Trees grow from left (root) to right (tips).
 * 
 * @param {Object} tree - Tree with nodes
 * @param {number} globalMinTime - Minimum time across all trees
 * @param {number} globalMaxTime - Maximum time across all trees
 */
export function scaleTimeCoordinates(tree, globalMinTime, globalMaxTime) {
    const timeRange = globalMaxTime - globalMinTime;

    if (timeRange === 0) {
        // All nodes at same time - spread evenly
        for (const node of tree.nodes) {
            node.x = 0.5;
        }
        return;
    }

    // X coordinate: 0 at globalMaxTime (oldest/root), 1 at globalMinTime (youngest/tips)
    // In tskit, higher time = older (towards root)
    for (const node of tree.nodes) {
        node.x = (globalMaxTime - node.time) / timeRange;
    }
}

/**
 * Normalize Y coordinates to [0, 1] range.
 * @param {Object} tree - Tree with nodes having y coordinates
 */
function normalizeTipCoordinates(tree) {
    if (!tree.nodes || tree.nodes.length === 0) {
        return;
    }

    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of tree.nodes) {
        const y = Number.isFinite(node.y) ? node.y : 0;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
        return;
    }

    const yRange = maxY - minY || 1;
    for (const node of tree.nodes) {
        node.y = (node.y - minY) / yRange;
    }
}

/**
 * Process tree from edge data - main entry point.
 * This produces output compatible with processNewick.
 * 
 * @param {Object} activeEdges - {parent, child} arrays for one tree
 * @param {Array} nodeTimes - Global node times array
 * @param {Object} mutationsByNode - {nodeId: [{position, mutation}, ...]}
 * @param {number} globalMinTime - Min time for scaling
 * @param {number} globalMaxTime - Max time for scaling
 * @returns {Object} Tree compatible with extractSquarePaths
 */
export function processTreeFromEdges(activeEdges, nodeTimes, mutationsByNode, globalMinTime, globalMaxTime) {
    // Build tree structure
    const tree = constructTreeFromEdges(activeEdges, nodeTimes, mutationsByNode);

    if (tree.roots.length === 0) {
        console.warn('[processTreeFromEdges] No roots found in tree');
        return tree;
    }

    // Ladderize: assign num_tips and sort
    for (const root of tree.roots) {
        assignNumTips(root);
        sortWithNumTips(root);
    }

    // Assign Y coordinates (tip ordering for vertical spread)
    assignTipCoordinates(tree);

    // Normalize Y to [0, 1]
    normalizeTipCoordinates(tree);

    // Scale X coordinates based on global time range (horizontal time axis)
    scaleTimeCoordinates(tree, globalMinTime, globalMaxTime);

    // Sort nodes by X (time) for consistent rendering
    tree.nodes.sort((a, b) => a.x - b.x);

    // Add root reference for compatibility with processNewick output
    tree.root = tree.roots[0];

    return tree;
}

/**
 * Build a single tree for a given global index from cached edge data.
 * 
 * @param {number} globalIndex - Tree index
 * @param {Object} edgesData - Cached edges {left, right, parent, child}
 * @param {Object} tsconfig - Config with intervals, node_times, mutations_by_node, times
 * @returns {Object} Processed tree ready for extractSquarePaths
 */
export function buildTreeFromEdges(globalIndex, edgesData, tsconfig) {
    const { intervals, node_times, mutations_by_node, times, genome_length } = tsconfig;

    if (!intervals || !node_times) {
        console.warn('[buildTreeFromEdges] Missing intervals or node_times in tsconfig');
        return null;
    }

    // Get tree interval bounds
    const treeStart = intervals[globalIndex];
    const treeEnd = intervals[globalIndex + 1] ?? genome_length;

    // Filter edges for this tree
    const activeEdges = filterActiveEdges(edgesData, treeStart, treeEnd);

    if (activeEdges.parent.length === 0) {
        console.warn(`[buildTreeFromEdges] No active edges for tree ${globalIndex}`);
        return null;
    }

    // Filter mutations to only include those within this tree's genomic interval
    const filteredMutations = {};
    if (mutations_by_node) {
        for (const [nodeId, muts] of Object.entries(mutations_by_node)) {
            // Filter mutations by position: only include if position is in [treeStart, treeEnd)
            const treeMuts = muts.filter(m => m.position >= treeStart && m.position < treeEnd);
            if (treeMuts.length > 0) {
                filteredMutations[nodeId] = treeMuts;
            }
        }
    }

    // Get global time range for scaling
    const globalMinTime = times?.values?.[0] ?? 0;
    const globalMaxTime = times?.values?.[1] ?? 1;

    // Process tree
    return processTreeFromEdges(
        activeEdges,
        node_times,
        filteredMutations,
        globalMinTime,
        globalMaxTime
    );
}
