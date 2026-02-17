/**
 * Shared render utilities used by render helpers and renderDataWorker.js.
 * Single source of truth for groupNodesByTree, groupMutationsByTree, and getTipColor.
 */

function isMapLike(value) {
  return value && typeof value.get === 'function';
}

function getNodeIndex(nodeIdToIdx, nodeId) {
  if (!nodeIdToIdx) return undefined;
  if (isMapLike(nodeIdToIdx)) return nodeIdToIdx.get(nodeId);
  return nodeIdToIdx[nodeId];
}

/**
 * Build mapping from backend-local tree indices to global indices when needed.
 * The backend may return local 0..N-1 indices when displayArray was requested.
 * Uses O(n) min/max check instead of O(n log n) sort when possible.
 */
export function createTreeIndexMapping(tree_idx, displayArray) {
  const indexMapping = new Map();
  if (!displayArray || !Array.isArray(displayArray) || !tree_idx || tree_idx.length === 0) {
    return indexMapping;
  }

  let minIdx = Infinity;
  let maxIdx = -Infinity;
  const seen = new Set();
  for (let i = 0; i < tree_idx.length; i++) {
    const v = tree_idx[i];
    seen.add(v);
    if (v < minIdx) minIdx = v;
    if (v > maxIdx) maxIdx = v;
  }

  const isZeroIndexed = seen.size > 0
    && minIdx === 0
    && maxIdx === displayArray.length - 1
    && !displayArray.includes(0)
    && displayArray.length === seen.size;

  if (isZeroIndexed) {
    displayArray.forEach((globalIdx, localIdx) => {
      indexMapping.set(localIdx, globalIdx);
    });
  }

  return indexMapping;
}

/**
 * Group node row indices by resolved tree index.
 * Returns Map<treeIdx, number[]>, where numbers index into input arrays.
 */
export function groupNodeIndicesByTree(tree_idx, displayArray) {
  const treeMap = new Map();
  const indexMapping = createTreeIndexMapping(tree_idx, displayArray);

  for (let i = 0; i < tree_idx.length; i++) {
    const rawTreeIdx = tree_idx[i];
    const tIdx = indexMapping.has(rawTreeIdx) ? indexMapping.get(rawTreeIdx) : rawTreeIdx;

    if (!treeMap.has(tIdx)) {
      treeMap.set(tIdx, []);
    }
    treeMap.get(tIdx).push(i);
  }

  return treeMap;
}

/**
 * Group mutation row indices by resolved tree index.
 * Returns Map<treeIdx, number[]>, where numbers index into mutation arrays.
 */
export function groupMutationIndicesByTree(mut_tree_idx, displayArray) {
  const mutMap = new Map();
  const indexMapping = createTreeIndexMapping(mut_tree_idx, displayArray);
  const length = mut_tree_idx?.length || 0;

  for (let i = 0; i < length; i++) {
    const rawTreeIdx = mut_tree_idx[i];
    const tIdx = indexMapping.has(rawTreeIdx) ? indexMapping.get(rawTreeIdx) : rawTreeIdx;

    if (!mutMap.has(tIdx)) {
      mutMap.set(tIdx, []);
    }
    mutMap.get(tIdx).push(i);
  }

  return mutMap;
}

/**
 * Precompute tip-color lookup context once per request.
 * Avoids per-tip `includes` checks and repeated color array allocation.
 */
export function createTipColorContext(metadataArrays, metadataColors, populationFilter, defaultColor) {
  const colorBy = populationFilter?.colorBy;
  if (!colorBy || !metadataArrays?.[colorBy] || !metadataColors?.[colorBy]) {
    return null;
  }

  const { uniqueValues, indices, nodeIdToIdx } = metadataArrays[colorBy];
  if (!uniqueValues || !indices || !nodeIdToIdx) {
    return null;
  }

  const enabledValues = Array.isArray(populationFilter?.enabledValues)
    ? populationFilter.enabledValues
    : null;
  const enabledValueSet = enabledValues ? new Set(enabledValues) : null;

  const colorByValue = metadataColors[colorBy];
  const resolvedColorByValue = new Map();
  for (const [value, color] of Object.entries(colorByValue)) {
    if (!Array.isArray(color) || color.length < 3) continue;
    resolvedColorByValue.set(value, [color[0], color[1], color[2], 200]);
  }

  return {
    uniqueValues,
    indices,
    nodeIdToIdx,
    enabledValueSet,
    resolvedColorByValue,
    defaultColor
  };
}

/**
 * Fast tip-color lookup using a precomputed context.
 */
export function getTipColorFromContext(nodeId, colorContext) {
  if (!colorContext) return null;

  const idx = getNodeIndex(colorContext.nodeIdToIdx, nodeId);
  if (idx === undefined) return colorContext.defaultColor;

  const valueIdx = colorContext.indices[idx];
  const value = colorContext.uniqueValues[valueIdx];

  if (colorContext.enabledValueSet && !colorContext.enabledValueSet.has(value)) {
    return colorContext.defaultColor;
  }

  return colorContext.resolvedColorByValue.get(value) || colorContext.defaultColor;
}

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
  const indexMapping = createTreeIndexMapping(tree_idx, displayArray);

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
  const context = createTipColorContext(
    metadataArrays,
    metadataColors,
    populationFilter,
    defaultColor
  );
  return getTipColorFromContext(nodeId, context) || defaultColor;
}
