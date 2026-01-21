/**
 * Render Data Worker
 *
 * Computes typed arrays for deck.gl rendering from tree data + localBins.
 * Runs in a web worker to offload computation from the main thread.
 *
 * Key optimizations:
 * - Reuses pre-allocated buffers to avoid per-call allocation
 * - Uses Float64Array to preserve precision for large coordinates
 * - Computes L-shaped paths and tip positions for all visible trees
 */

// Reusable buffers to avoid per-call allocation
let pathBuffer = null;
let tipBuffer = null;
let colorBuffer = null;
let pathStartIndicesBuffer = null;

// Buffer sizing constants
const BUFFER_GROWTH_FACTOR = 1.5;
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
 *
 * @param {Array} node_id - Node IDs
 * @param {Array} parent_id - Parent node IDs
 * @param {Array} is_tip - Tip flags
 * @param {Array} tree_idx - Tree indices from backend (may be 0-indexed or global)
 * @param {Array} x - X coordinates
 * @param {Array} y - Y coordinates
 * @param {Array} displayArray - Global tree indices that were requested (for mapping)
 * @returns {Map} Map of global tree index -> nodes
 */
function groupNodesByTree(node_id, parent_id, is_tip, tree_idx, x, y, displayArray) {
  const treeMap = new Map();
  const length = node_id.length;

  // Create mapping from backend's tree_idx to global indices
  // The backend may return tree_idx as 0-indexed positions within the response
  // displayArray contains the actual global indices that were requested
  const indexMapping = new Map();
  if (displayArray && Array.isArray(displayArray)) {
    // Get unique tree_idx values to check if they're 0-indexed or global
    const uniqueTreeIdx = [...new Set(tree_idx)].sort((a, b) => a - b);

    // If tree_idx values are 0, 1, 2, ... they're likely 0-indexed
    // If they match displayArray values, they're global indices
    const isZeroIndexed = uniqueTreeIdx.length > 0 &&
      uniqueTreeIdx[0] === 0 &&
      !displayArray.includes(0) &&
      displayArray.length === uniqueTreeIdx.length;

    if (isZeroIndexed) {
      displayArray.forEach((globalIdx, localIdx) => {
        indexMapping.set(localIdx, globalIdx);
      });
    }
  }

  for (let i = 0; i < length; i++) {
    // Map tree_idx to global index if needed
    const rawTreeIdx = tree_idx[i];
    const tIdx = indexMapping.has(rawTreeIdx) ? indexMapping.get(rawTreeIdx) : rawTreeIdx;

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
 * Main computation function - generates render arrays for all trees
 *
 * @param {Object} data - Input data
 * @param {Array} data.node_id - Node IDs
 * @param {Array} data.parent_id - Parent node IDs (-1 for roots)
 * @param {Array} data.is_tip - Boolean flags for tip nodes
 * @param {Array} data.tree_idx - Tree index for each node
 * @param {Array} data.x - X coordinates (time-based [0,1])
 * @param {Array} data.y - Y coordinates (genealogy-based [0,1])
 * @param {Array} data.modelMatrices - Array of {key, modelMatrix} objects
 * @param {Array} data.displayArray - Global tree indices that were requested
 * @param {Object} data.metadataArrays - Metadata for coloring
 * @param {Object} data.metadataColors - Color mapping
 * @param {Object} data.populationFilter - Active filter settings
 * @returns {Object} Render data with typed arrays
 */
function computeRenderArrays(data) {
  const {
    node_id, parent_id, is_tip, tree_idx, x, y,
    modelMatrices, displayArray, metadataArrays, metadataColors, populationFilter
  } = data;

  // Convert modelMatrices array to Map for efficient lookup
  const modelMatricesMap = new Map();
  if (modelMatrices && Array.isArray(modelMatrices)) {
    for (const item of modelMatrices) {
      if (item.modelMatrix) {
        modelMatricesMap.set(item.key, item.modelMatrix);
      }
    }
  }

  // Handle empty data
  if (!node_id || node_id.length === 0 || modelMatricesMap.size === 0) {
    return {
      pathPositions: new Float64Array(0),
      pathStartIndices: [0],
      tipPositions: new Float64Array(0),
      tipColors: new Uint8Array(0),
      tipData: [],
      edgeData: [],
      edgeCount: 0,
      tipCount: 0
    };
  }

  // Group nodes by tree (with mapping from backend's tree_idx to global indices)
  const treeNodesMap = groupNodesByTree(node_id, parent_id, is_tip, tree_idx, x, y, displayArray);

  // Calculate total nodes for buffer sizing
  let totalNodes = 0;
  for (const [treeIdx] of modelMatricesMap) {
    const treeNodes = treeNodesMap.get(treeIdx);
    if (treeNodes) totalNodes += treeNodes.length;
  }

  // Ensure buffers are large enough
  const pathSize = totalNodes * 6;  // 6 floats per L-shape (3 points * 2 coords)
  const tipSize = totalNodes * 2;   // 2 floats per tip
  const colorSize = totalNodes * 4; // 4 bytes RGBA per tip

  // Use Float64Array to preserve precision for large coordinates
  pathBuffer = ensureBuffer(pathBuffer, pathSize, Float64Array);
  tipBuffer = ensureBuffer(tipBuffer, tipSize, Float64Array);
  colorBuffer = ensureBuffer(colorBuffer, colorSize, Uint8Array);
  pathStartIndicesBuffer = ensureBuffer(pathStartIndicesBuffer, totalNodes + 1, Uint32Array);

  const defaultTipColor = [150, 150, 150, 200];

  let pathOffset = 0;
  let tipOffset = 0;
  let colorOffset = 0;
  let edgeCount = 0;
  let pathStartIndexCount = 0;

  pathStartIndicesBuffer[pathStartIndexCount++] = 0;

  const tipData = [];
  const edgeData = [];

  // Process each tree that has a modelMatrix
  for (const [treeIdx, modelMatrix] of modelMatricesMap) {
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

    // Get transform from modelMatrix (array format: [m0, m1, ..., m15])
    const m = modelMatrix;
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
        edgeData.push({
          tree_idx: treeIdx,
          parent_id: node.node_id,
          child_id: childNode.node_id
        });
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
    edgeData,
    edgeCount,
    tipCount: tipOffset / 2
  };
}

/**
 * Clear cached buffers to free memory
 */
function clearBuffers() {
  pathBuffer = null;
  tipBuffer = null;
  colorBuffer = null;
  pathStartIndicesBuffer = null;
}

// Worker message handler
onmessage = (event) => {
  const { type, id, data } = event.data;

  if (type === 'compute-render-data') {
    try {
      const result = computeRenderArrays(data);

      // Transfer typed arrays for better performance
      const transferables = [
        result.pathPositions.buffer,
        result.tipPositions.buffer,
        result.tipColors.buffer
      ];

      postMessage({ type: 'render-data-result', id, success: true, data: result }, transferables);
    } catch (error) {
      console.error('[RenderWorker] Error computing render data:', error);
      postMessage({ type: 'render-data-result', id, success: false, error: error.message });
    }
  }

  if (type === 'clear-buffers') {
    clearBuffers();
    postMessage({ type: 'clear-buffers-result', id, success: true });
  }
};
