/**
 * Shared render utilities used by render helpers and renderDataWorker.js.
 * Single source of truth for groupNodesByTree, groupMutationsByTree, and getTipColor.
 */

/**
 * Group nodes by tree index for efficient per-tree processing.
 * Supports both 0-indexed (backend response positions) and global tree indices.
 *
 * @param {Array} node_id - Node IDs
 * @param {Array} parent_id - Parent node IDs
 * @param {Array} is_tip - Tip flags
 * @param {Array} tree_idx - Tree indices from backend (may be 0-indexed or global)
 * @param {Array} x - X coordinates (layout/horizontal)
 * @param {Array} y - Y coordinates (time/vertical)
 * @param {Array} name - Node names (for tips)
 * @param {Array} displayArray - Global tree indices that were requested (for mapping)
 * @returns {Map} Map of global tree index -> nodes
 */
export function groupNodesByTree(node_id, parent_id, is_tip, tree_idx, x, y, name, displayArray) {
  const treeMap = new Map();
  const length = node_id.length;

  const indexMapping = new Map();
  if (displayArray && Array.isArray(displayArray)) {
    const uniqueTreeIdx = [...new Set(tree_idx)].sort((a, b) => a - b);
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
    const rawTreeIdx = tree_idx[i];
    const tIdx = indexMapping.has(rawTreeIdx) ? indexMapping.get(rawTreeIdx) : rawTreeIdx;

    if (!treeMap.has(tIdx)) {
      treeMap.set(tIdx, []);
    }

    treeMap.get(tIdx).push({
      node_id: node_id[i],
      parent_id: parent_id[i],
      is_tip: is_tip[i],
      x: x[i],
      y: y[i],
      name: name?.[i] || ''
    });
  }

  return treeMap;
}

/**
 * Group mutations by tree index for efficient per-tree processing.
 *
 * @param {Array} mut_x - X coordinates (layout/horizontal)
 * @param {Array} mut_y - Y coordinates (time/vertical)
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
      x: mut_x[i],
      y: mut_y[i]
    });
  }

  return mutMap;
}

/**
 * Get tip color based on metadata.
 * Uses O(1) lookup via metadataArrays.
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

  if (!populationFilter.enabledValues?.includes(value)) {
    return [150, 150, 150, 100];
  }

  const color = metadataColors[colorBy][value];
  return color ? [...color.slice(0, 3), 200] : defaultColor;
}
