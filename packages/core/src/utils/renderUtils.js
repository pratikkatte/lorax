/**
 * Render data computation utilities.
 * Pure functions for computing typed arrays for deck.gl rendering.
 * Can run on either main thread or web worker.
 */

/**
 * Group nodes by tree index for efficient per-tree processing
 *
 * @param {Array} node_id - Node IDs
 * @param {Array} parent_id - Parent node IDs
 * @param {Array} is_tip - Tip flags
 * @param {Array} tree_idx - Tree indices from backend (always global indices)
 * @param {Array} x - X coordinates
 * @param {Array} y - Y coordinates
 * @param {Array} displayArray - Global tree indices that were requested (for diagnostics)
 * @returns {Map} Map of global tree index -> nodes
 */
export function groupNodesByTree(node_id, parent_id, is_tip, tree_idx, x, y, displayArray) {
  const treeMap = new Map();
  const length = node_id.length;

  // Backend always sends global tree indices in tree_idx column
  // No mapping needed - use tree_idx directly
  for (let i = 0; i < length; i++) {
    const tIdx = tree_idx[i];  // Already global index

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

  // Diagnostic logging
  console.log('[groupNodesByTree] Trees with data:', Array.from(treeMap.keys()));
  console.log('[groupNodesByTree] displayArray:', displayArray);

  return treeMap;
}

/**
 * Group mutations by tree index for efficient per-tree processing
 * Simplified: only needs x, y, tree_idx
 *
 * @param {Array} mut_x - X coordinates (time-based)
 * @param {Array} mut_y - Y coordinates (layout-based)
 * @param {Array} mut_tree_idx - Tree indices from backend
 * @returns {Map} Map of global tree index -> mutations
 */
export function groupMutationsByTree(mut_x, mut_y, mut_tree_idx) {
  const mutMap = new Map();
  const length = mut_tree_idx?.length || 0;

  for (let i = 0; i < length; i++) {
    const tIdx = mut_tree_idx[i];

    if (!mutMap.has(tIdx)) {
      mutMap.set(tIdx, []);
    }

    mutMap.get(tIdx).push({
      x: mut_x[i],      // time-based [0,1]
      y: mut_y[i]       // layout-based [0,1]
    });
  }

  return mutMap;
}

/**
 * Get tip color based on metadata
 * Uses O(1) lookup via metadataArrays
 */
export function getTipColor(nodeId, metadataArrays, metadataColors, populationFilter, defaultColor) {
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
 * Compute render arrays for tree visualization (synchronous)
 *
 * This is the main-thread equivalent of renderDataWorker's computeRenderArrays.
 * Generates typed arrays for deck.gl rendering from tree data + localBins.
 *
 * @param {Object} data - Input data
 * @param {Array} data.node_id - Node IDs
 * @param {Array} data.parent_id - Parent node IDs (-1 for roots)
 * @param {Array} data.is_tip - Boolean flags for tip nodes
 * @param {Array} data.tree_idx - Tree index for each node
 * @param {Array} data.x - X coordinates (time-based [0,1])
 * @param {Array} data.y - Y coordinates (genealogy-based [0,1])
 * @param {Array} data.mut_x - Mutation X coordinates
 * @param {Array} data.mut_y - Mutation Y coordinates
 * @param {Array} data.mut_tree_idx - Mutation tree indices
 * @param {Array} data.modelMatrices - Array of {key, modelMatrix} objects or Map
 * @param {Array} data.displayArray - Global tree indices that were requested
 * @param {Object} data.metadataArrays - Metadata for coloring
 * @param {Object} data.metadataColors - Color mapping
 * @param {Object} data.populationFilter - Active filter settings
 * @returns {Object} Render data with typed arrays
 */
export function computeRenderArrays(data) {
  const {
    node_id, parent_id, is_tip, tree_idx, x, y,
    mut_x, mut_y, mut_tree_idx,
    modelMatrices, displayArray, metadataArrays, metadataColors, populationFilter
  } = data;

  // Convert modelMatrices to Map for efficient lookup
  // Support both array format and Map format
  let modelMatricesMap;
  if (modelMatrices instanceof Map) {
    modelMatricesMap = modelMatrices;
  } else if (Array.isArray(modelMatrices)) {
    modelMatricesMap = new Map();
    for (const item of modelMatrices) {
      if (item.modelMatrix) {
        modelMatricesMap.set(item.key, item.modelMatrix);
      }
    }
  } else {
    modelMatricesMap = new Map();
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
      tipCount: 0,
      // Mutation arrays (simplified: only positions)
      mutPositions: new Float64Array(0),
      mutCount: 0
    };
  }

  // Group nodes by tree (with mapping from backend's tree_idx to global indices)
  const treeNodesMap = groupNodesByTree(node_id, parent_id, is_tip, tree_idx, x, y, displayArray);

  // Group mutations by tree (simplified: only x, y, tree_idx)
  const treeMutationsMap = groupMutationsByTree(mut_x, mut_y, mut_tree_idx);

  // Calculate total nodes and mutations for buffer sizing
  let totalNodes = 0;
  let totalMutations = 0;
  for (const [treeIdx] of modelMatricesMap) {
    const treeNodes = treeNodesMap.get(treeIdx);
    const treeMutations = treeMutationsMap.get(treeIdx);
    if (treeNodes) totalNodes += treeNodes.length;
    if (treeMutations) totalMutations += treeMutations.length;
  }

  // Pre-allocate buffers
  const pathSize = totalNodes * 6;  // 6 floats per L-shape (3 points * 2 coords)
  const tipSize = totalNodes * 2;   // 2 floats per tip
  const colorSize = totalNodes * 4; // 4 bytes RGBA per tip
  const mutSize = totalMutations * 2;   // 2 floats per mutation

  const pathBuffer = new Float64Array(pathSize);
  const tipBuffer = new Float64Array(tipSize);
  const colorBuffer = new Uint8Array(colorSize);
  const pathStartIndicesBuffer = new Uint32Array(totalNodes + 1);
  const mutBuffer = new Float64Array(mutSize);

  const defaultTipColor = [150, 150, 150, 200];

  let pathOffset = 0;
  let tipOffset = 0;
  let colorOffset = 0;
  let edgeCount = 0;
  let pathStartIndexCount = 0;
  let mutOffset = 0;

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
    const m = Array.isArray(modelMatrix) ? modelMatrix : modelMatrix;
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

    // Process mutations for this tree (simplified: only positions)
    const treeMutations = treeMutationsMap.get(treeIdx);
    if (treeMutations && treeMutations.length > 0) {
      for (const mut of treeMutations) {
        // Apply same transform as nodes:
        // World X = y (layout) * scaleX + translateX (horizontal position)
        // World Y = x (time) (vertical position)
        const mutWorldX = mut.y * scaleX + translateX;
        const mutWorldY = mut.x;

        mutBuffer[mutOffset++] = mutWorldX;
        mutBuffer[mutOffset++] = mutWorldY;
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
    tipCount: tipOffset / 2,
    // Mutation data (simplified: only positions)
    mutPositions: mutBuffer.slice(0, mutOffset),
    mutCount: mutOffset / 2
  };
}

/**
 * Serialize localBins Map for worker transfer
 * Extracts only trees with modelMatrix (visible trees)
 *
 * @param {Map} bins - Map of tree index -> bin data
 * @returns {Array} Array of { key, modelMatrix } objects
 */
export function serializeModelMatrices(bins) {
  if (!bins || !(bins instanceof Map)) return [];

  const result = [];
  for (const [key, value] of bins.entries()) {
    if (value.modelMatrix && value.visible !== false) {
      result.push({
        key,
        modelMatrix: Array.isArray(value.modelMatrix)
          ? value.modelMatrix
          : value.modelMatrix.toArray?.() ?? value.modelMatrix
      });
    }
  }
  return result;
}

/**
 * Build a Map from serialized modelMatrices for main-thread computation
 *
 * @param {Map} localBins - Map of tree index -> bin data
 * @returns {Map} Map of tree index -> modelMatrix array
 */
export function buildModelMatricesMap(localBins) {
  if (!localBins || !(localBins instanceof Map)) return new Map();

  const map = new Map();
  for (const [key, value] of localBins.entries()) {
    if (value.modelMatrix && value.visible !== false) {
      const matrix = Array.isArray(value.modelMatrix)
        ? value.modelMatrix
        : value.modelMatrix.toArray?.() ?? value.modelMatrix;
      map.set(key, matrix);
    }
  }
  return map;
}
