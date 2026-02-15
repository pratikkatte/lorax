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

import {
  groupNodeIndicesByTree,
  groupMutationIndicesByTree,
  createTipColorContext,
  getTipColorFromContext
} from './modules/renderShared.js';

// Reusable buffers to avoid per-call allocation
let pathBuffer = null;
let tipBuffer = null;
let colorBuffer = null;
let pathStartIndicesBuffer = null;
let mutBuffer = null;

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

function getEmptyRenderData() {
  return {
    pathPositions: new Float64Array(0),
    pathStartIndices: new Uint32Array([0]),
    tipPositions: new Float64Array(0),
    tipColors: new Uint8Array(0),
    tipData: [],
    treeLabelMeta: [],
    edgeData: [],
    edgeCount: 0,
    tipCount: 0,
    mutPositions: new Float64Array(0),
    mutCount: 0
  };
}

/**
 * Main computation function - generates render arrays for all trees
 *
 * @param {Object} data - Input data
 * @param {Array} data.node_id - Node IDs
 * @param {Array} data.parent_id - Parent node IDs (-1 for roots)
 * @param {Array} data.is_tip - Boolean flags for tip nodes
 * @param {Array} data.tree_idx - Tree index for each node
 * @param {Array} data.x - X coordinates (layout/horizontal [0,1])
 * @param {Array} data.y - Y coordinates (time/vertical [0,1])
 * @param {Array} data.name - Node names (for tips)
 * @param {Array} data.mut_x - Mutation X coordinates (layout/horizontal)
 * @param {Array} data.mut_y - Mutation Y coordinates (time/vertical)
 * @param {Array} data.mut_tree_idx - Mutation tree indices
 * @param {Array} data.modelMatrices - Array of {key, modelMatrix} objects
 * @param {Array} data.displayArray - Global tree indices that were requested
 * @param {Object} data.metadataArrays - Metadata for coloring
 * @param {Object} data.metadataColors - Color mapping
 * @param {Object} data.populationFilter - Active filter settings
 * @param {boolean} data.includeTipData - Whether to include object payload for tip picking
 * @param {boolean} data.includeEdgeData - Whether to include object payload for edge metadata/picking
 * @returns {Object} Render data with typed arrays
 */
function computeRenderArrays(data) {
  const {
    node_id, parent_id, is_tip, tree_idx, x, y, name,
    mut_x, mut_y, mut_tree_idx,
    modelMatrices, displayArray, metadataArrays, metadataColors, populationFilter,
    includeTipData = true,
    includeEdgeData = true
  } = data;

  // Convert modelMatrices array to Map for efficient lookup
  const modelMatricesMap = new Map();
  if (modelMatrices && Array.isArray(modelMatrices)) {
    for (const item of modelMatrices) {
      const key = Number(item?.key);
      if (item?.modelMatrix && Number.isFinite(key)) {
        modelMatricesMap.set(key, item.modelMatrix);
      }
    }
  }

  // Handle empty data
  if (!node_id || node_id.length === 0 || modelMatricesMap.size === 0) {
    return getEmptyRenderData();
  }

  // Group rows by tree using row indices (minimizes object churn).
  const treeNodeIndicesMap = groupNodeIndicesByTree(tree_idx, displayArray);
  const treeMutationIndicesMap = groupMutationIndicesByTree(mut_tree_idx, displayArray);

  const defaultTipColor = [150, 150, 150, 200];
  const tipColorContext = createTipColorContext(
    metadataArrays,
    metadataColors,
    populationFilter,
    defaultTipColor
  );

  // Calculate total nodes and mutations for buffer sizing
  let totalNodes = 0;
  let totalMutations = 0;
  for (const [treeIdx] of modelMatricesMap) {
    const nodeIndices = treeNodeIndicesMap.get(treeIdx);
    const mutationIndices = treeMutationIndicesMap.get(treeIdx);
    if (nodeIndices) totalNodes += nodeIndices.length;
    if (mutationIndices) totalMutations += mutationIndices.length;
  }

  // Ensure buffers are large enough
  const pathSize = totalNodes * 6;  // 6 floats per L-shape (3 points * 2 coords)
  const tipSize = totalNodes * 2;   // 2 floats per tip
  const colorSize = totalNodes * 4; // 4 bytes RGBA per tip
  const mutSize = totalMutations * 2;   // 2 floats per mutation

  // Use Float64Array to preserve precision for large coordinates
  pathBuffer = ensureBuffer(pathBuffer, pathSize, Float64Array);
  tipBuffer = ensureBuffer(tipBuffer, tipSize, Float64Array);
  colorBuffer = ensureBuffer(colorBuffer, colorSize, Uint8Array);
  pathStartIndicesBuffer = ensureBuffer(pathStartIndicesBuffer, totalNodes + 1, Uint32Array);
  mutBuffer = ensureBuffer(mutBuffer, mutSize, Float64Array);

  let pathOffset = 0;
  let tipOffset = 0;
  let colorOffset = 0;
  let edgeCount = 0;
  let pathStartIndexCount = 0;
  let mutOffset = 0;

  pathStartIndicesBuffer[pathStartIndexCount++] = 0;

  const tipData = includeTipData ? [] : [];
  const treeLabelMeta = [];
  const edgeData = includeEdgeData ? [] : null;

  // Process each tree that has a modelMatrix
  for (const [treeIdx, modelMatrix] of modelMatricesMap) {
    const treeNodeIndices = treeNodeIndicesMap.get(treeIdx);
    if (!treeNodeIndices || treeNodeIndices.length === 0) continue;

    // Get transform from modelMatrix (array format: [m0, m1, ..., m15])
    const m = modelMatrix;
    const scaleX = m?.[0] ?? 1;
    const translateX = m?.[12] ?? 0;

    treeLabelMeta.push({
      tree_idx: treeIdx,
      nodeCount: treeNodeIndices.length,
      scaleX
    });

    // Build tree-local map: node_id -> row index in source arrays.
    const nodeIdToRow = new Map();
    for (let i = 0; i < treeNodeIndices.length; i++) {
      const row = treeNodeIndices[i];
      nodeIdToRow.set(node_id[row], row);
    }

    // Generate L-shaped edges by iterating child rows and resolving parent rows.
    for (let i = 0; i < treeNodeIndices.length; i++) {
      const childRow = treeNodeIndices[i];
      const parentNodeId = parent_id[childRow];
      if (parentNodeId === -1) continue;

      const parentRow = nodeIdToRow.get(parentNodeId);
      if (parentRow === undefined) continue;

      const px = x[parentRow];
      const py = y[parentRow];
      const cx = x[childRow];
      const cy = y[childRow];

      pathBuffer[pathOffset++] = px * scaleX + translateX;
      pathBuffer[pathOffset++] = py;
      pathBuffer[pathOffset++] = cx * scaleX + translateX;
      pathBuffer[pathOffset++] = py;
      pathBuffer[pathOffset++] = cx * scaleX + translateX;
      pathBuffer[pathOffset++] = cy;

      pathStartIndicesBuffer[pathStartIndexCount++] = pathOffset / 2;

      if (includeEdgeData) {
        edgeData.push({
          tree_idx: treeIdx,
          parent_id: node_id[parentRow],
          child_id: node_id[childRow]
        });
      }

      edgeCount++;
    }

    // Collect tip positions/colors.
    for (let i = 0; i < treeNodeIndices.length; i++) {
      const row = treeNodeIndices[i];
      if (!is_tip[row]) continue;

      const tipX = x[row] * scaleX + translateX;
      const tipY = y[row];

      tipBuffer[tipOffset++] = tipX;
      tipBuffer[tipOffset++] = tipY;

      const color = getTipColorFromContext(node_id[row], tipColorContext) || defaultTipColor;
      colorBuffer[colorOffset++] = color[0];
      colorBuffer[colorOffset++] = color[1];
      colorBuffer[colorOffset++] = color[2];
      colorBuffer[colorOffset++] = color[3] ?? 200;

      if (includeTipData) {
        tipData.push({
          node_id: node_id[row],
          tree_idx: treeIdx,
          position: [tipX, tipY],
          name: name?.[row] || ''
        });
      }
    }

    // Process mutations for this tree.
    const treeMutationIndices = treeMutationIndicesMap.get(treeIdx);
    if (treeMutationIndices && treeMutationIndices.length > 0) {
      for (let i = 0; i < treeMutationIndices.length; i++) {
        const row = treeMutationIndices[i];
        mutBuffer[mutOffset++] = mut_x[row] * scaleX + translateX;
        mutBuffer[mutOffset++] = mut_y[row];
      }
    }
  }

  // Return subarrays of the pre-allocated buffers
  return {
    pathPositions: pathBuffer.slice(0, pathOffset),
    pathStartIndices: pathStartIndicesBuffer.subarray(0, pathStartIndexCount),
    tipPositions: tipBuffer.slice(0, tipOffset),
    tipColors: colorBuffer.slice(0, colorOffset),
    tipData,
    treeLabelMeta,
    edgeData: edgeData || [],
    edgeCount,
    tipCount: tipOffset / 2,
    // Mutation data (simplified: only positions)
    mutPositions: mutBuffer.slice(0, mutOffset),
    mutCount: mutOffset / 2
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
  mutBuffer = null;
}

const workerScope = typeof self !== 'undefined' ? self : globalThis;

// Worker message handler
workerScope.onmessage = (event) => {
  const { type, id, data } = event.data;

  if (type === 'compute-render-data') {
    try {
      const result = computeRenderArrays(data);

      // Transfer typed arrays for better performance
      const transferables = [
        result.pathPositions.buffer,
        result.tipPositions.buffer,
        result.tipColors.buffer,
        result.mutPositions.buffer
      ];

      workerScope.postMessage({ type: 'render-data-result', id, success: true, data: result }, transferables);
    } catch (error) {
      console.error('[RenderWorker] Error computing render data:', error);
      workerScope.postMessage({ type: 'render-data-result', id, success: false, error: error.message });
    }
  }

  if (type === 'clear-buffers') {
    clearBuffers();
    workerScope.postMessage({ type: 'clear-buffers-result', id, success: true });
  }
};

export { computeRenderArrays };
