/**
 * Render Data Computation Module
 *
 * Computes typed arrays for deck.gl rendering from post-order tree data.
 * This runs in the web worker to offload computation from the main thread.
 *
 * Key optimizations:
 * - Reuses pre-allocated buffers to avoid per-call allocation
 * - Uses Float32Array with relative coordinates for memory efficiency
 * - Computes L-shaped paths and tip positions for all visible trees
 */

// Reusable buffers to avoid per-call allocation
let pathBuffer = null;
let tipBuffer = null;
let colorBuffer = null;
let pathStartIndicesBuffer = null;

// Buffer sizing constants
const BUFFER_GROWTH_FACTOR = 1.5; // Grow by 50% when needed
const MIN_BUFFER_SIZE = 1000;

/**
 * Ensure buffer is large enough, reallocating if necessary
 */
function ensureBuffer(currentBuffer, requiredSize, ArrayType) {
  if (!currentBuffer || currentBuffer.length < requiredSize) {
    const newSize = Math.max(MIN_BUFFER_SIZE, Math.ceil(requiredSize * BUFFER_GROWTH_FACTOR));
    return new ArrayType(newSize);
  }
  return currentBuffer;
}

/**
 * Group nodes by tree index for efficient per-tree processing
 */
function groupNodesByTree(node_id, parent_id, is_tip, tree_idx, x, y) {
  const treeMap = new Map();
  const length = node_id.length;

  for (let i = 0; i < length; i++) {
    const tIdx = tree_idx[i];

    if (!treeMap.has(tIdx)) {
      treeMap.set(tIdx, []);
    }

    treeMap.get(tIdx).push({
      node_id: node_id[i],
      parent_id: parent_id[i],
      is_tip: is_tip[i],
      x: x[i],  // time-based [0,1], root=0, tips=1
      y: y[i]   // genealogy-based [0,1]
    });
  }

  return treeMap;
}

/**
 * Get tip color based on metadata
 * Uses O(1) lookup via metadataArrays
 */
function getTipColor(nodeId, metadataArrays, metadataColors, populationFilter, defaultColor) {
  const colorBy = populationFilter?.colorBy;

  if (!colorBy || !metadataArrays?.[colorBy] || !metadataColors?.[colorBy]) {
    return defaultColor;
  }

  const { uniqueValues, indices, nodeIdToIdx } = metadataArrays[colorBy];
  const idx = nodeIdToIdx?.get(nodeId);

  if (idx === undefined) return defaultColor;

  const valueIdx = indices[idx];
  const value = uniqueValues[valueIdx];

  // Check if value is enabled in filter
  if (!populationFilter.enabledValues?.includes(value)) {
    return [150, 150, 150, 100]; // Dimmed for disabled values
  }

  const color = metadataColors[colorBy][value];
  return color ? [...color.slice(0, 3), 200] : defaultColor;
}

/**
 * Main computation function - generates render arrays for all visible trees
 *
 * @param {Object} data - Input data
 * @param {TypedArray} data.node_id - Node IDs
 * @param {TypedArray} data.parent_id - Parent node IDs (-1 for roots)
 * @param {TypedArray} data.is_tip - Boolean flags for tip nodes
 * @param {TypedArray} data.tree_idx - Tree index for each node
 * @param {TypedArray} data.x - X coordinates (time-based [0,1])
 * @param {TypedArray} data.y - Y coordinates (genealogy-based [0,1])
 * @param {Map} data.bins - Bin data with modelMatrix and visibility
 * @param {Object} data.metadataArrays - Metadata for coloring
 * @param {Object} data.metadataColors - Color mapping
 * @param {Object} data.populationFilter - Active filter settings
 * @returns {Object} Render data with typed arrays
 */
export function computeRenderArrays(data) {
  const {
    node_id, parent_id, is_tip, tree_idx, x, y,
    bins, metadataArrays, metadataColors, populationFilter
  } = data;

  // Handle empty data
  if (!node_id || node_id.length === 0 || !bins || bins.size === 0) {
    return {
      pathPositions: new Float32Array(0),
      pathStartIndices: [0],
      tipPositions: new Float32Array(0),
      tipColors: new Uint8Array(0),
      tipData: [],
      edgeCount: 0,
      tipCount: 0
    };
  }

  // Group nodes by tree
  const treeNodesMap = groupNodesByTree(node_id, parent_id, is_tip, tree_idx, x, y);

  // Calculate total visible nodes for buffer sizing
  let totalVisibleNodes = 0;
  for (const [key, bin] of bins) {
    if (!bin.visible) continue;
    const treeNodes = treeNodesMap.get(bin.global_index);
    if (treeNodes) totalVisibleNodes += treeNodes.length;
  }

  // Ensure buffers are large enough
  const pathSize = totalVisibleNodes * 6;  // 6 floats per L-shape (3 points * 2 coords)
  const tipSize = totalVisibleNodes * 2;   // 2 floats per tip
  const colorSize = totalVisibleNodes * 4; // 4 bytes RGBA per tip

  pathBuffer = ensureBuffer(pathBuffer, pathSize, Float32Array);
  tipBuffer = ensureBuffer(tipBuffer, tipSize, Float32Array);
  colorBuffer = ensureBuffer(colorBuffer, colorSize, Uint8Array);
  pathStartIndicesBuffer = ensureBuffer(pathStartIndicesBuffer, totalVisibleNodes + 1, Uint32Array);

  const defaultTipColor = [150, 150, 150, 200];

  let pathOffset = 0;
  let tipOffset = 0;
  let colorOffset = 0;
  let edgeCount = 0;
  let pathStartIndexCount = 0;

  pathStartIndicesBuffer[pathStartIndexCount++] = 0;

  const tipData = [];

  // Process each visible tree
  for (const [key, bin] of bins) {
    if (!bin.visible) continue;

    const treeIdx = bin.global_index;
    const treeNodes = treeNodesMap.get(treeIdx);

    if (!treeNodes || treeNodes.length === 0) continue;

    // Build node map for this tree
    const nodeMap = new Map();
    for (const n of treeNodes) {
      nodeMap.set(n.node_id, {
        node_id: n.node_id,
        x: n.x,
        y: n.y,
        is_tip: n.is_tip,
        parent_id: n.parent_id,
        children: []
      });
    }

    // Build children arrays
    for (const n of treeNodes) {
      if (n.parent_id !== -1) {
        const parent = nodeMap.get(n.parent_id);
        const child = nodeMap.get(n.node_id);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    }

    // Get transform from bin's modelMatrix
    const m = bin.modelMatrix;
    const scaleX = m[0];
    const translateX = m[12];

    // Generate L-shaped edges
    for (const node of nodeMap.values()) {
      if (node.children.length === 0) continue;

      const py = node.y;  // Parent Y (normalized [0, 1])
      const pt = node.x;  // Parent X (time)

      for (const childNode of node.children) {
        const cy = childNode.y;
        const ct = childNode.x;

        // L-shape path: parent -> horizontal to child y -> down to child
        // World X = y * scaleX + translateX (y is the horizontal spread)
        // World Y = t (time is the vertical axis)
        pathBuffer[pathOffset++] = py * scaleX + translateX;
        pathBuffer[pathOffset++] = pt;
        pathBuffer[pathOffset++] = cy * scaleX + translateX;
        pathBuffer[pathOffset++] = pt;
        pathBuffer[pathOffset++] = cy * scaleX + translateX;
        pathBuffer[pathOffset++] = ct;

        pathStartIndicesBuffer[pathStartIndexCount++] = pathOffset / 2;
        edgeCount++;
      }
    }

    // Collect tip positions and colors
    for (const node of nodeMap.values()) {
      if (node.is_tip) {
        const tipX = node.y * scaleX + translateX;
        const tipY = node.x;

        tipBuffer[tipOffset++] = tipX;
        tipBuffer[tipOffset++] = tipY;

        // Get color from metadata
        const color = getTipColor(
          node.node_id,
          metadataArrays,
          metadataColors,
          populationFilter,
          defaultTipColor
        );

        colorBuffer[colorOffset++] = color[0];
        colorBuffer[colorOffset++] = color[1];
        colorBuffer[colorOffset++] = color[2];
        colorBuffer[colorOffset++] = color[3] ?? 200;

        tipData.push({
          node_id: node.node_id,
          tree_idx: treeIdx,
          position: [tipX, tipY]
        });
      }
    }
  }

  // Return subarrays of the pre-allocated buffers
  return {
    pathPositions: pathBuffer.slice(0, pathOffset),
    pathStartIndices: Array.from(pathStartIndicesBuffer.subarray(0, pathStartIndexCount)),
    tipPositions: tipBuffer.slice(0, tipOffset),
    tipColors: colorBuffer.slice(0, colorOffset),
    tipData,
    edgeCount,
    tipCount: tipOffset / 2
  };
}

/**
 * Clear cached buffers to free memory
 * Call this when switching files or when memory pressure is high
 */
export function clearBuffers() {
  pathBuffer = null;
  tipBuffer = null;
  colorBuffer = null;
  pathStartIndicesBuffer = null;
}
