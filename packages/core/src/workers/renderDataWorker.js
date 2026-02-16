/**
 * Render Data Worker
 *
 * Computes typed arrays for deck.gl rendering from tree data + localBins.
 * Runs in a web worker to offload computation from the main thread.
 *
 * Key optimizations:
 * - Structure cache: when treeData per tree is unchanged, only apply modelMatrix transform
 * - Reuses pre-allocated buffers to avoid per-call allocation
 * - Uses Float64Array to preserve precision for large coordinates
 */

import {
  groupNodeIndicesByTree,
  groupMutationIndicesByTree,
  createTipColorContext,
  getTipColorFromContext
} from './modules/renderShared.js';

// Reusable buffers
let pathBuffer = null;
let tipBuffer = null;
let colorBuffer = null;
let pathStartIndicesBuffer = null;
let mutBuffer = null;

// Structure cache (layout-space coords, invariant to modelMatrix)
let pathPositionsLocal = null;
let tipPositionsLocal = null;
let mutPositionsLocal = null;
let pathTreeIndices = null;
let tipTreeIndices = null;
let mutTreeIndices = null;
let cachedPathStartIndices = null;
let cachedTipColors = null;
let cachedEdgeData = null;
let cachedTipMeta = null;
let cachedTreeStructures = null;
let cachedEdgeCount = 0;
let cachedTipCount = 0;
let cachedMutCount = 0;
let cachedPathStartIndexCount = 0;

const BUFFER_GROWTH_FACTOR = 1.5;
const MIN_BUFFER_SIZE = 1000;

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

function treeStructuresFromPlain(plain) {
  if (!plain || typeof plain !== 'object') return null;
  const m = new Map();
  for (const [k, v] of Object.entries(plain)) {
    const key = Number(k);
    if (Number.isFinite(key) && v && typeof v === 'object') {
      m.set(key, { nodeCount: v.nodeCount ?? 0, mutCount: v.mutCount ?? 0 });
    }
  }
  return m;
}

function treeStructuresMatch(a, b) {
  if (!a || !b) return false;
  if (a.size !== b.size) return false;
  for (const [key, valA] of a) {
    const valB = b.get(key);
    if (!valB || valA.nodeCount !== valB.nodeCount || valA.mutCount !== valB.mutCount) {
      return false;
    }
  }
  return true;
}

/**
 * Full compute: structure phase (layout coords) + transform phase.
 * Optionally caches structure when treeStructures provided.
 */
function computeRenderArrays(data) {
  const {
    node_id,
    parent_id,
    is_tip,
    tree_idx,
    x,
    y,
    name,
    mut_x,
    mut_y,
    mut_tree_idx,
    modelMatrices,
    displayArray,
    metadataArrays,
    metadataColors,
    populationFilter,
    includeTipData = true,
    includeEdgeData = true,
    treeStructures: requestedTreeStructures
  } = data;

  const modelMatricesMap = new Map();
  if (modelMatrices && Array.isArray(modelMatrices)) {
    for (const item of modelMatrices) {
      const key = Number(item?.key);
      if (item?.modelMatrix && Number.isFinite(key)) {
        modelMatricesMap.set(key, item.modelMatrix);
      }
    }
  }

  if (!node_id || node_id.length === 0 || modelMatricesMap.size === 0) {
    return getEmptyRenderData();
  }

  const treeNodeIndicesMap = groupNodeIndicesByTree(tree_idx, displayArray);
  const treeMutationIndicesMap = groupMutationIndicesByTree(mut_tree_idx, displayArray);

  const defaultTipColor = [150, 150, 150, 200];
  const tipColorContext = createTipColorContext(
    metadataArrays,
    metadataColors,
    populationFilter,
    defaultTipColor
  );

  let totalNodes = 0;
  let totalMutations = 0;
  for (const [treeIdx] of modelMatricesMap) {
    const nodeIndices = treeNodeIndicesMap.get(treeIdx);
    const mutationIndices = treeMutationIndicesMap.get(treeIdx);
    if (nodeIndices) totalNodes += nodeIndices.length;
    if (mutationIndices) totalMutations += mutationIndices.length;
  }

  const pathSize = totalNodes * 6;
  const tipSize = totalNodes * 2;
  const colorSize = totalNodes * 4;
  const mutSize = totalMutations * 2;

  pathBuffer = ensureBuffer(pathBuffer, pathSize, Float64Array);
  tipBuffer = ensureBuffer(tipBuffer, tipSize, Float64Array);
  colorBuffer = ensureBuffer(colorBuffer, colorSize, Uint8Array);
  pathStartIndicesBuffer = ensureBuffer(pathStartIndicesBuffer, totalNodes + 1, Uint32Array);
  mutBuffer = ensureBuffer(mutBuffer, mutSize, Float64Array);

  if (requestedTreeStructures) {
    pathPositionsLocal = ensureBuffer(pathPositionsLocal, pathSize, Float64Array);
    tipPositionsLocal = ensureBuffer(tipPositionsLocal, tipSize, Float64Array);
    mutPositionsLocal = ensureBuffer(mutPositionsLocal, mutSize, Float64Array);
    pathTreeIndices = ensureBuffer(pathTreeIndices, totalNodes, Uint32Array);
    tipTreeIndices = ensureBuffer(tipTreeIndices, totalNodes, Uint32Array);
    mutTreeIndices = ensureBuffer(mutTreeIndices, totalMutations, Uint32Array);
  }

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
  const tipMeta = includeTipData ? [] : null;

  const builtTreeStructures = new Map();

  for (const [treeIdx, modelMatrix] of modelMatricesMap) {
    const treeNodeIndices = treeNodeIndicesMap.get(treeIdx);
    if (!treeNodeIndices || treeNodeIndices.length === 0) continue;

    const m = modelMatrix;
    const scaleX = m?.[0] ?? 1;
    const translateX = m?.[12] ?? 0;

    treeLabelMeta.push({
      tree_idx: treeIdx,
      nodeCount: treeNodeIndices.length,
      scaleX
    });

    builtTreeStructures.set(treeIdx, {
      nodeCount: treeNodeIndices.length,
      mutCount: (treeMutationIndicesMap.get(treeIdx) || []).length
    });

    const nodeIdToRow = new Map();
    for (let i = 0; i < treeNodeIndices.length; i++) {
      const row = treeNodeIndices[i];
      nodeIdToRow.set(node_id[row], row);
    }

    for (let i = 0; i < treeNodeIndices.length; i++) {
      const row = treeNodeIndices[i];

      if (parent_id[row] !== -1) {
        const parentRow = nodeIdToRow.get(parent_id[row]);
        if (parentRow !== undefined) {
          const px = x[parentRow];
          const py = y[parentRow];
          const cx = x[row];
          const cy = y[row];

          const pathIdx = pathOffset;
          pathBuffer[pathIdx] = px * scaleX + translateX;
          pathBuffer[pathIdx + 1] = py;
          pathBuffer[pathIdx + 2] = cx * scaleX + translateX;
          pathBuffer[pathIdx + 3] = py;
          pathBuffer[pathIdx + 4] = cx * scaleX + translateX;
          pathBuffer[pathIdx + 5] = cy;
          pathOffset += 6;

          if (requestedTreeStructures) {
            pathPositionsLocal[pathIdx] = px;
            pathPositionsLocal[pathIdx + 1] = py;
            pathPositionsLocal[pathIdx + 2] = cx;
            pathPositionsLocal[pathIdx + 3] = py;
            pathPositionsLocal[pathIdx + 4] = cx;
            pathPositionsLocal[pathIdx + 5] = cy;
            pathTreeIndices[edgeCount] = treeIdx;
          }

          pathStartIndicesBuffer[pathStartIndexCount++] = pathOffset / 2;

          if (includeEdgeData) {
            edgeData.push({
              tree_idx: treeIdx,
              parent_id: node_id[parentRow],
              child_id: node_id[row]
            });
          }

          edgeCount++;
        }
      }

      if (is_tip[row]) {
        const tipX = x[row] * scaleX + translateX;
        const tipY = y[row];

        const tipIdx = tipOffset;
        tipBuffer[tipIdx] = tipX;
        tipBuffer[tipIdx + 1] = tipY;
        tipOffset += 2;

        if (requestedTreeStructures) {
          tipPositionsLocal[tipIdx] = x[row];
          tipPositionsLocal[tipIdx + 1] = y[row];
          tipTreeIndices[tipIdx / 2] = treeIdx;
        }

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
          if (tipMeta) {
            tipMeta.push({
              node_id: node_id[row],
              tree_idx: treeIdx,
              name: name?.[row] || ''
            });
          }
        }
      }
    }

    const treeMutationIndices = treeMutationIndicesMap.get(treeIdx);
    if (treeMutationIndices && treeMutationIndices.length > 0) {
      for (let i = 0; i < treeMutationIndices.length; i++) {
        const row = treeMutationIndices[i];
        const mutIdx = mutOffset;
        mutBuffer[mutIdx] = mut_x[row] * scaleX + translateX;
        mutBuffer[mutIdx + 1] = mut_y[row];
        mutOffset += 2;

        if (requestedTreeStructures) {
          mutPositionsLocal[mutIdx] = mut_x[row];
          mutPositionsLocal[mutIdx + 1] = mut_y[row];
          mutTreeIndices[mutIdx / 2] = treeIdx;
        }
      }
    }
  }

  if (requestedTreeStructures) {
    cachedPathStartIndices = pathStartIndicesBuffer.slice(0, pathStartIndexCount);
    cachedTipColors = colorBuffer.slice(0, colorOffset);
    cachedEdgeData = edgeData ? [...edgeData] : [];
    cachedTipMeta = tipMeta ? tipMeta.map((t) => ({ ...t })) : [];
    cachedTreeStructures = new Map(builtTreeStructures);
    cachedEdgeCount = edgeCount;
    cachedTipCount = tipOffset / 2;
    cachedMutCount = mutOffset / 2;
    cachedPathStartIndexCount = pathStartIndexCount;
  }

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
    mutPositions: mutBuffer.slice(0, mutOffset),
    mutCount: mutOffset / 2
  };
}

/**
 * Apply modelMatrix transform to cached structure. Returns result or null on cache miss.
 */
function applyTransform(data) {
  const { modelMatrices, treeStructures } = data;

  if (
    !pathPositionsLocal ||
    !cachedTreeStructures ||
    !treeStructures
  ) {
    return { cacheMiss: true };
  }

  const requested = treeStructuresFromPlain(treeStructures);
  if (!requested || !treeStructuresMatch(requested, cachedTreeStructures)) {
    return { cacheMiss: true };
  }

  const modelMatricesMap = new Map();
  if (modelMatrices && Array.isArray(modelMatrices)) {
    for (const item of modelMatrices) {
      const key = Number(item?.key);
      if (item?.modelMatrix && Number.isFinite(key)) {
        modelMatricesMap.set(key, item.modelMatrix);
      }
    }
  }

  const edgeCount = cachedEdgeCount;
  const tipCount = cachedTipCount;
  const mutCount = cachedMutCount;
  const pathCoordCount = edgeCount * 6;
  const tipCoordCount = tipCount * 2;
  const mutCoordCount = mutCount * 2;

  pathBuffer = ensureBuffer(pathBuffer, pathCoordCount, Float64Array);
  tipBuffer = ensureBuffer(tipBuffer, tipCoordCount, Float64Array);
  mutBuffer = ensureBuffer(mutBuffer, mutCoordCount, Float64Array);

  const treeScaleTranslate = new Map();
  for (const item of modelMatrices || []) {
    const key = Number(item?.key);
    if (Number.isFinite(key) && item?.modelMatrix) {
      const m = item.modelMatrix;
      treeScaleTranslate.set(key, {
        scaleX: m[0] ?? 1,
        translateX: m[12] ?? 0
      });
    }
  }

  for (let i = 0; i < pathCoordCount; i += 6) {
    const treeIdx = pathTreeIndices[i / 6];
    const { scaleX, translateX } = treeScaleTranslate.get(treeIdx) || { scaleX: 1, translateX: 0 };

    pathBuffer[i] = pathPositionsLocal[i] * scaleX + translateX;
    pathBuffer[i + 1] = pathPositionsLocal[i + 1];
    pathBuffer[i + 2] = pathPositionsLocal[i + 2] * scaleX + translateX;
    pathBuffer[i + 3] = pathPositionsLocal[i + 3];
    pathBuffer[i + 4] = pathPositionsLocal[i + 4] * scaleX + translateX;
    pathBuffer[i + 5] = pathPositionsLocal[i + 5];
  }

  for (let i = 0; i < tipCoordCount; i += 2) {
    const treeIdx = tipTreeIndices[i / 2];
    const { scaleX, translateX } = treeScaleTranslate.get(treeIdx) || { scaleX: 1, translateX: 0 };

    tipBuffer[i] = tipPositionsLocal[i] * scaleX + translateX;
    tipBuffer[i + 1] = tipPositionsLocal[i + 1];
  }

  for (let i = 0; i < mutCoordCount; i += 2) {
    const treeIdx = mutTreeIndices[i / 2];
    const { scaleX, translateX } = treeScaleTranslate.get(treeIdx) || { scaleX: 1, translateX: 0 };

    mutBuffer[i] = mutPositionsLocal[i] * scaleX + translateX;
    mutBuffer[i + 1] = mutPositionsLocal[i + 1];
  }

  const treeLabelMeta = [];
  for (const [treeIdx, { scaleX }] of treeScaleTranslate) {
    const struct = cachedTreeStructures.get(treeIdx);
    const nodeCount = struct ? struct.nodeCount : 0;
    treeLabelMeta.push({ tree_idx: treeIdx, nodeCount, scaleX });
  }

  const tipData = cachedTipMeta
    ? cachedTipMeta.map((meta, i) => ({
        node_id: meta.node_id,
        tree_idx: meta.tree_idx,
        position: [tipBuffer[i * 2], tipBuffer[i * 2 + 1]],
        name: meta.name || ''
      }))
    : [];

  return {
    pathPositions: pathBuffer.slice(0, pathCoordCount),
    pathStartIndices: cachedPathStartIndices,
    tipPositions: tipBuffer.slice(0, tipCoordCount),
    tipColors: cachedTipColors,
    tipData,
    treeLabelMeta,
    edgeData: cachedEdgeData || [],
    edgeCount,
    tipCount,
    mutPositions: mutBuffer.slice(0, mutCoordCount),
    mutCount
  };
}

function clearBuffers() {
  pathBuffer = null;
  tipBuffer = null;
  colorBuffer = null;
  pathStartIndicesBuffer = null;
  mutBuffer = null;
  pathPositionsLocal = null;
  tipPositionsLocal = null;
  mutPositionsLocal = null;
  pathTreeIndices = null;
  tipTreeIndices = null;
  mutTreeIndices = null;
  cachedPathStartIndices = null;
  cachedTipColors = null;
  cachedEdgeData = null;
  cachedTipMeta = null;
  cachedTreeStructures = null;
}

const workerScope = typeof self !== 'undefined' ? self : globalThis;

workerScope.onmessage = (event) => {
  const { type, id, data } = event.data;

  if (type === 'compute-render-data') {
    try {
      const result = computeRenderArrays(data);

      const transferables = [
        result.pathPositions.buffer,
        result.tipPositions.buffer,
        result.tipColors.buffer,
        result.mutPositions.buffer
      ];
      if (result.pathStartIndices && result.pathStartIndices.buffer) {
        if (!transferables.includes(result.pathStartIndices.buffer)) {
          transferables.push(result.pathStartIndices.buffer);
        }
      }

      workerScope.postMessage({ type: 'render-data-result', id, success: true, data: result }, transferables);
    } catch (error) {
      console.error('[RenderWorker] Error computing render data:', error);
      workerScope.postMessage({ type: 'render-data-result', id, success: false, error: error.message });
    }
  }

  if (type === 'apply-transform') {
    try {
      const result = applyTransform(data);
      if (result.cacheMiss) {
        workerScope.postMessage({ type: 'render-data-result', id, success: true, data: result });
      } else {
        const transferables = [
          result.pathPositions.buffer,
          result.tipPositions.buffer,
          result.tipColors.buffer,
          result.mutPositions.buffer
        ];
        if (result.pathStartIndices?.buffer && !transferables.includes(result.pathStartIndices.buffer)) {
          transferables.push(result.pathStartIndices.buffer);
        }
        workerScope.postMessage({ type: 'render-data-result', id, success: true, data: result }, transferables);
      }
    } catch (error) {
      console.error('[RenderWorker] Error applying transform:', error);
      workerScope.postMessage({ type: 'render-data-result', id, success: true, data: { cacheMiss: true } });
    }
  }

  if (type === 'clear-buffers') {
    clearBuffers();
    workerScope.postMessage({ type: 'clear-buffers-result', id, success: true });
  }
};

/**
 * Clear worker state (buffers + structure cache). For testing.
 */
function clearWorkerState() {
  clearBuffers();
}

export { computeRenderArrays, applyTransform, clearWorkerState };
