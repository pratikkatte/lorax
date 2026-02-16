import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { serializeModelMatrices } from '../utils/renderUtils.js';
import { createTreeIndexMapping } from '../workers/modules/renderShared.js';
import { useWorker } from './useWorker.jsx';
import { getRenderDataWorker } from '../workers/workerSpecs.js';

const EMPTY_DISPLAY_ARRAY = [];
const STRUCTURE_CACHE_MIN_NODES = 5000;

function toTypedArray(arr, ArrayType) {
  if (!arr || arr.length === 0) return new ArrayType(0);
  if (arr instanceof ArrayType) return arr;
  return new ArrayType(arr);
}

function buildFullComputePayload(treeData, serializedModelMatrices, displayArray, metadataArrays, metadataColors, populationFilter, treeStructures) {
  const payload = {
    node_id: toTypedArray(treeData.node_id, Int32Array),
    parent_id: toTypedArray(treeData.parent_id, Int32Array),
    is_tip: toTypedArray(treeData.is_tip, Uint8Array),
    tree_idx: toTypedArray(treeData.tree_idx, Uint32Array),
    x: toTypedArray(treeData.x, Float64Array),
    y: toTypedArray(treeData.y, Float64Array),
    name: treeData.name,
    mut_x: toTypedArray(treeData.mut_x, Float64Array),
    mut_y: toTypedArray(treeData.mut_y, Float64Array),
    mut_tree_idx: toTypedArray(treeData.mut_tree_idx, Uint32Array),
    modelMatrices: serializedModelMatrices,
    displayArray: displayArray ?? EMPTY_DISPLAY_ARRAY,
    metadataArrays,
    metadataColors,
    populationFilter,
    treeStructures
  };

  const transfer = [];
  const addTransfer = (v) => {
    if (v && v.buffer && v.buffer.byteLength > 0 && !transfer.includes(v.buffer)) {
      transfer.push(v.buffer);
    }
  };
  addTransfer(payload.node_id);
  addTransfer(payload.parent_id);
  addTransfer(payload.is_tip);
  addTransfer(payload.tree_idx);
  addTransfer(payload.x);
  addTransfer(payload.y);
  addTransfer(payload.mut_x);
  addTransfer(payload.mut_y);
  addTransfer(payload.mut_tree_idx);

  return { payload, transfer };
}

/**
 * Get per-tree structure (nodeCount, mutCount) for visible trees.
 * Uses same tree-index resolution as worker (displayArray/local 0..N-1 vs global).
 * @param {Object} treeData - Tree data with tree_idx, mut_tree_idx
 * @param {number[]} visibleTreeIndices - Keys of visible trees
 * @param {number[]} displayArray - Global tree indices
 * @returns {Map<number, { nodeCount: number, mutCount: number }>}
 */
function getTreeStructures(treeData, visibleTreeIndices, displayArray) {
  const { tree_idx, mut_tree_idx } = treeData;
  if (!tree_idx || tree_idx.length === 0) return new Map();

  const indexMapping = createTreeIndexMapping(tree_idx, displayArray);
  const structures = new Map();

  for (const globalIdx of visibleTreeIndices) {
    let nodeCount = 0;
    let mutCount = 0;

    for (let i = 0; i < tree_idx.length; i++) {
      const resolved = indexMapping.has(tree_idx[i]) ? indexMapping.get(tree_idx[i]) : tree_idx[i];
      if (resolved === globalIdx) nodeCount++;
    }

    if (mut_tree_idx && mut_tree_idx.length > 0) {
      const mutMapping = createTreeIndexMapping(mut_tree_idx, displayArray);
      for (let i = 0; i < mut_tree_idx.length; i++) {
        const resolved = mutMapping.has(mut_tree_idx[i]) ? mutMapping.get(mut_tree_idx[i]) : mut_tree_idx[i];
        if (resolved === globalIdx) mutCount++;
      }
    }

    structures.set(globalIdx, { nodeCount, mutCount });
  }

  return structures;
}

/**
 * Check if two tree-structure Maps match (same keys, same nodeCount/mutCount per key).
 */
function structuresMatch(a, b) {
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
 * Serialize modelMatrices for comparison (scaleX, translateX per tree).
 */
function getModelMatricesKey(serialized) {
  if (!serialized || serialized.length === 0) return '';
  return serialized
    .map(({ key, modelMatrix }) => `${key}:${modelMatrix?.[0] ?? 1},${modelMatrix?.[12] ?? 0}`)
    .sort((x, y) => x.localeCompare(y))
    .join(';');
}

/**
 * Check if we should skip render computation (missing data or no visible trees).
 * @returns {{ skip: boolean, visibleCount?: number }}
 */
function shouldSkipRender(localBins, treeData) {
  if (!localBins || !treeData || !treeData.node_id || treeData.node_id.length === 0) {
    return { skip: true };
  }
  let visibleCount = 0;
  for (const [, value] of localBins.entries()) {
    if (value.modelMatrix && value.visible !== false) visibleCount++;
  }
  if (visibleCount === 0) {
    return { skip: true };
  }
  return { skip: false, visibleCount };
}

/**
 * Hook to compute render data (typed arrays) for tree visualization.
 * Sends tree data + localBins to worker, receives typed arrays for deck.gl layers.
 *
 * When structure (treeData per tree) is unchanged but modelMatrix changes,
 * sends apply-transform only for cheaper pan/zoom updates.
 *
 * @param {Object} params
 * @param {Map|null} params.localBins - Map of tree_idx -> { modelMatrix, ... } from useLocalData
 * @param {Object|null} params.treeData - { node_id[], parent_id[], is_tip[], tree_idx[], x(layout)[], y(time)[] } from useTreeData
 * @param {Array|null} params.displayArray - Global tree indices that were requested from backend
 * @param {Object} params.metadataArrays - Optional metadata for tip coloring
 * @param {Object} params.metadataColors - Optional color mapping for metadata values
 * @param {Object} params.populationFilter - Optional { colorBy, enabledValues }
 * @returns {Object} { renderData, isLoading, error, isReady, clearBuffers }
 */
export function useRenderData({
  localBins,
  treeData,
  displayArray = null,
  metadataArrays = null,
  metadataColors = null,
  populationFilter = null
}) {
  const [renderData, setRenderData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const latestRequestId = useRef(0);
  const lastTreeStructuresRef = useRef(null);
  const lastModelMatricesKeyRef = useRef('');

  const worker = useWorker(getRenderDataWorker);

  const serializedModelMatrices = useMemo(() => serializeModelMatrices(localBins), [localBins]);
  const visibleTreeIndices = useMemo(
    () => serializedModelMatrices.map(({ key }) => key).sort((a, b) => a - b),
    [serializedModelMatrices]
  );

  const currentTreeStructures = useMemo(() => {
    if (!treeData || visibleTreeIndices.length === 0) return null;
    return getTreeStructures(treeData, visibleTreeIndices, displayArray ?? EMPTY_DISPLAY_ARRAY);
  }, [treeData, visibleTreeIndices, displayArray]);

  const totalNodeCount = treeData?.node_id?.length ?? 0;
  const useStructureCache = totalNodeCount >= STRUCTURE_CACHE_MIN_NODES;

  const structureUnchanged = useStructureCache && structuresMatch(lastTreeStructuresRef.current, currentTreeStructures);
  const modelMatricesUnchanged = getModelMatricesKey(serializedModelMatrices) === lastModelMatricesKeyRef.current;

  useEffect(() => {
    if (!worker.isReady) return;

    const { skip } = shouldSkipRender(localBins, treeData);
    if (skip) {
      setRenderData(null);
      return;
    }

    if (structureUnchanged && modelMatricesUnchanged) {
      return;
    }

    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    setError(null);

    const doFullCompute = () => {
      const { payload, transfer } = buildFullComputePayload(
        treeData,
        serializedModelMatrices,
        displayArray ?? EMPTY_DISPLAY_ARRAY,
        metadataArrays,
        metadataColors,
        populationFilter,
        useStructureCache ? structuresToPlain(currentTreeStructures) : null
      );
      return worker.request('compute-render-data', payload, { transfer });
    };

    const doApplyTransform = () => {
      return worker.request('apply-transform', {
        modelMatrices: serializedModelMatrices,
        treeStructures: structuresToPlain(currentTreeStructures)
      });
    };

    (async () => {
      try {
        let result;

        if (structureUnchanged && useStructureCache && lastTreeStructuresRef.current !== null) {
          result = await doApplyTransform();
          if (result?.cacheMiss) {
            result = await doFullCompute();
          }
        } else {
          result = await doFullCompute();
        }

        if (requestId !== latestRequestId.current) return;

        setRenderData(result);
        setIsLoading(false);

        if (result && useStructureCache && currentTreeStructures) {
          lastTreeStructuresRef.current = currentTreeStructures;
          lastModelMatricesKeyRef.current = getModelMatricesKey(serializedModelMatrices);
        }
      } catch (err) {
        if (requestId !== latestRequestId.current) return;
        console.error('[useRenderData] Failed to compute render data:', err);
        setError(err);
        setIsLoading(false);
      }
    })();
  }, [
    worker,
    localBins,
    treeData,
    displayArray,
    metadataArrays,
    metadataColors,
    populationFilter,
    serializedModelMatrices,
    visibleTreeIndices,
    currentTreeStructures,
    structureUnchanged,
    modelMatricesUnchanged,
    useStructureCache
  ]);

  const clearBuffers = useCallback(() => {
    if (!worker.isReady) return Promise.resolve();
    lastTreeStructuresRef.current = null;
    lastModelMatricesKeyRef.current = '';
    return worker.request('clear-buffers', null);
  }, [worker]);

  return useMemo(
    () => ({
      renderData,
      isLoading,
      error,
      isReady: worker.isReady,
      clearBuffers
    }),
    [renderData, isLoading, error, worker.isReady, clearBuffers]
  );
}

function structuresToPlain(structures) {
  if (!structures) return null;
  const obj = {};
  for (const [k, v] of structures) {
    obj[k] = { nodeCount: v.nodeCount, mutCount: v.mutCount };
  }
  return obj;
}
