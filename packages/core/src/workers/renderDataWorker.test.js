import { beforeEach, describe, expect, it } from 'vitest';

import { serializeMetadataArraysForRpc } from '../rpc/createRpcWorker.js';
import {
  computeRenderArrays,
  applyTransform,
  clearWorkerState,
  createRenderDataCache
} from './renderDataWorker.js';

function modelMatrix(scaleX = 1, translateX = 0) {
  return [
    scaleX, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    translateX, 0, 0, 1
  ];
}

function makeTreeData({
  treeIdx,
  rootNodeId = 100,
  tipNodeIds = [101, 102],
  rootX = 0.5,
  tipXs = [0.2, 0.8],
  rootY = 0.1,
  tipY = 0.9,
  mutX = 0.6,
  mutY = 0.4
}) {
  return {
    node_id: [rootNodeId, tipNodeIds[0], tipNodeIds[1]],
    parent_id: [-1, rootNodeId, rootNodeId],
    is_tip: [false, true, true],
    tree_idx: [treeIdx, treeIdx, treeIdx],
    x: [rootX, tipXs[0], tipXs[1]],
    y: [rootY, tipY, tipY],
    name: ['', `tip-${tipNodeIds[0]}`, `tip-${tipNodeIds[1]}`],
    mut_x: [mutX],
    mut_y: [mutY],
    mut_tree_idx: [treeIdx]
  };
}

function getTreeStructures(treeData, displayArray) {
  const structures = {};
  for (const idx of displayArray) {
    let nodeCount = 0;
    let mutCount = 0;
    for (let i = 0; i < treeData.tree_idx.length; i++) {
      if (treeData.tree_idx[i] === idx) nodeCount++;
    }
    if (treeData.mut_tree_idx) {
      for (let i = 0; i < treeData.mut_tree_idx.length; i++) {
        if (treeData.mut_tree_idx[i] === idx) mutCount++;
      }
    }
    structures[idx] = { nodeCount, mutCount };
  }
  return structures;
}

/** Simplified mirror of JBrowse BaseRpcDriver.filterArgs (cloning behavior). */
function simulateJbrowseFilterArgs(thing) {
  function isClonable(x) {
    return typeof x !== 'function' && !(x instanceof Error);
  }
  function filterArgs(x) {
    if (Array.isArray(x)) {
      return x.filter(isClonable).map((t) => filterArgs(t));
    }
    if (typeof x === 'object' && x !== null) {
      return Object.fromEntries(
        Object.entries(x)
          .filter((e) => isClonable(e[1]))
          .map(([k, v]) => [k, filterArgs(v)])
      );
    }
    return x;
  }
  return filterArgs(thing);
}

describe('renderDataWorker metadata / JBrowse RPC shape', () => {
  beforeEach(() => {
    clearWorkerState();
  });

  it('serializeMetadataArraysForRpc preserves nodeIdToIdx through filterArgs', () => {
    const key = 'population';
    const nodeIdToIdx = new Map([
      [101, 0],
      [102, 1]
    ]);
    const metadataArrays = {
      [key]: {
        uniqueValues: ['A', 'B'],
        indices: new Uint16Array([0, 1]),
        nodeIdToIdx,
      },
    };

    const rawFiltered = simulateJbrowseFilterArgs(metadataArrays);
    expect(Object.keys(rawFiltered[key].nodeIdToIdx).length).toBe(0);

    const serialized = serializeMetadataArraysForRpc(metadataArrays);
    const filtered = simulateJbrowseFilterArgs(serialized);
    expect(filtered[key].nodeIdToIdx[101]).toBe(0);
    expect(filtered[key].nodeIdToIdx[102]).toBe(1);
    expect(Array.isArray(filtered[key].indices)).toBe(true);
    expect(filtered[key].indices[0]).toBe(0);
    expect(filtered[key].indices[1]).toBe(1);
  });

  it('computeRenderArrays tints tips from RPC-shaped metadataArrays', () => {
    const treeData = makeTreeData({ treeIdx: 1, tipNodeIds: [101, 102] });
    const displayArray = [1];
    const treeStructures = getTreeStructures(treeData, displayArray);
    const metadataKey = 'population';
    const metadataArrays = {
      [metadataKey]: {
        uniqueValues: ['A', 'B'],
        indices: [0, 1],
        nodeIdToIdx: { 101: 0, 102: 1 },
      },
    };
    const metadataColors = {
      [metadataKey]: {
        A: [255, 0, 0, 255],
        B: [0, 0, 255, 255],
      },
    };
    const populationFilter = {
      colorBy: metadataKey,
      enabledValues: ['A', 'B'],
    };

    const result = computeRenderArrays({
      node_id: treeData.node_id,
      parent_id: treeData.parent_id,
      is_tip: treeData.is_tip,
      tree_idx: treeData.tree_idx,
      x: treeData.x,
      y: treeData.y,
      name: treeData.name,
      mut_x: treeData.mut_x,
      mut_y: treeData.mut_y,
      mut_tree_idx: treeData.mut_tree_idx,
      modelMatrices: [{ key: 1, modelMatrix: modelMatrix(1, 0) }],
      displayArray,
      treeStructures,
      metadataArrays,
      metadataColors,
      populationFilter,
    });

    expect(result.tipCount).toBe(2);
    const c0 = Array.from(result.tipColors.slice(0, 4));
    const c1 = Array.from(result.tipColors.slice(4, 8));
    expect(c0).not.toEqual(c1);
    expect(c0[0]).toBe(255);
    expect(c0[1]).toBe(0);
    expect(c0[2]).toBe(0);
    expect(c1[0]).toBe(0);
    expect(c1[1]).toBe(0);
    expect(c1[2]).toBe(255);
  });
});

describe('renderDataWorker structure cache and apply-transform', () => {
  beforeEach(() => {
    clearWorkerState();
  });

  it('computes render data and caches structure for apply-transform', () => {
    const treeData = makeTreeData({ treeIdx: 7, rootX: 0.5, tipXs: [0.2, 0.8], mutX: 0.6 });
    const displayArray = [7];
    const treeStructures = getTreeStructures(treeData, displayArray);

    const result = computeRenderArrays({
      node_id: treeData.node_id,
      parent_id: treeData.parent_id,
      is_tip: treeData.is_tip,
      tree_idx: treeData.tree_idx,
      x: treeData.x,
      y: treeData.y,
      name: treeData.name,
      mut_x: treeData.mut_x,
      mut_y: treeData.mut_y,
      mut_tree_idx: treeData.mut_tree_idx,
      modelMatrices: [{ key: 7, modelMatrix: modelMatrix(2, 10) }],
      displayArray,
      treeStructures
    });

    expect(result.edgeCount).toBe(2);
    expect(result.tipCount).toBe(2);
    expect(result.mutCount).toBe(1);
    expect(Array.from(result.pathStartIndices)).toEqual([0, 3, 6]);
    expect(Array.from(result.tipPositions)).toEqual([10.4, 0.9, 11.6, 0.9]);
    expect(Array.from(result.mutPositions)).toEqual([11.2, 0.4]);
    expect(result.tipData[0].position).toEqual([10.4, 0.9]);
    expect(result.tipData[1].position).toEqual([11.6, 0.9]);
  });

  it('supports matrix-only pan/zoom updates via apply-transform', () => {
    const treeData = makeTreeData({ treeIdx: 4, tipXs: [0.1, 0.9] });
    const displayArray = [4];
    const treeStructures = getTreeStructures(treeData, displayArray);

    computeRenderArrays({
      node_id: treeData.node_id,
      parent_id: treeData.parent_id,
      is_tip: treeData.is_tip,
      tree_idx: treeData.tree_idx,
      x: treeData.x,
      y: treeData.y,
      name: treeData.name,
      mut_x: treeData.mut_x,
      mut_y: treeData.mut_y,
      mut_tree_idx: treeData.mut_tree_idx,
      modelMatrices: [{ key: 4, modelMatrix: modelMatrix(1, 0) }],
      displayArray,
      treeStructures
    });

    const renderA = applyTransform({
      modelMatrices: [{ key: 4, modelMatrix: modelMatrix(1, 0) }],
      treeStructures
    });

    const renderB = applyTransform({
      modelMatrices: [{ key: 4, modelMatrix: modelMatrix(3, -1) }],
      treeStructures
    });

    expect(renderA.cacheMiss).toBeUndefined();
    expect(renderB.cacheMiss).toBeUndefined();
    expect(Array.from(renderA.tipPositions)).toEqual([0.1, 0.9, 0.9, 0.9]);
    expect(Array.from(renderB.tipPositions)).toEqual([-0.7, 0.9, 1.7000000000000002, 0.9]);
    expect(renderB.edgeCount).toBe(renderA.edgeCount);
  });

  it('returns cacheMiss when structure does not match', () => {
    const treeData = makeTreeData({ treeIdx: 9 });
    const displayArray = [9];
    const treeStructures = getTreeStructures(treeData, displayArray);

    computeRenderArrays({
      node_id: treeData.node_id,
      parent_id: treeData.parent_id,
      is_tip: treeData.is_tip,
      tree_idx: treeData.tree_idx,
      x: treeData.x,
      y: treeData.y,
      name: treeData.name,
      mut_x: treeData.mut_x,
      mut_y: treeData.mut_y,
      mut_tree_idx: treeData.mut_tree_idx,
      modelMatrices: [{ key: 9, modelMatrix: modelMatrix(1, 0) }],
      displayArray,
      treeStructures,
      metadataArrays: null,
      metadataColors: null,
      populationFilter: null
    });

    const wrongStructures = { 9: { nodeCount: 999, mutCount: 0 } };
    const result = applyTransform({
      modelMatrices: [{ key: 9, modelMatrix: modelMatrix(1, 0) }],
      treeStructures: wrongStructures
    });

    expect(result.cacheMiss).toBe(true);
  });

  it('replaces cached structure when tree data changes (full compute overwrites cache)', () => {
    const initialTreeData = makeTreeData({ treeIdx: 3, tipXs: [0.1, 0.9] });
    const refreshedTreeData = makeTreeData({ treeIdx: 3, tipXs: [0.4, 0.95] });
    const displayArray = [3];

    computeRenderArrays({
      node_id: initialTreeData.node_id,
      parent_id: initialTreeData.parent_id,
      is_tip: initialTreeData.is_tip,
      tree_idx: initialTreeData.tree_idx,
      x: initialTreeData.x,
      y: initialTreeData.y,
      name: initialTreeData.name,
      mut_x: initialTreeData.mut_x,
      mut_y: initialTreeData.mut_y,
      mut_tree_idx: initialTreeData.mut_tree_idx,
      modelMatrices: [{ key: 3, modelMatrix: modelMatrix(1, 0) }],
      displayArray,
      treeStructures: getTreeStructures(initialTreeData, displayArray)
    });

    const initialRender = applyTransform({
      modelMatrices: [{ key: 3, modelMatrix: modelMatrix(1, 0) }],
      treeStructures: getTreeStructures(initialTreeData, displayArray)
    });

    computeRenderArrays({
      node_id: refreshedTreeData.node_id,
      parent_id: refreshedTreeData.parent_id,
      is_tip: refreshedTreeData.is_tip,
      tree_idx: refreshedTreeData.tree_idx,
      x: refreshedTreeData.x,
      y: refreshedTreeData.y,
      name: refreshedTreeData.name,
      mut_x: refreshedTreeData.mut_x,
      mut_y: refreshedTreeData.mut_y,
      mut_tree_idx: refreshedTreeData.mut_tree_idx,
      modelMatrices: [{ key: 3, modelMatrix: modelMatrix(1, 0) }],
      displayArray,
      treeStructures: getTreeStructures(refreshedTreeData, displayArray)
    });

    const refreshedRender = applyTransform({
      modelMatrices: [{ key: 3, modelMatrix: modelMatrix(1, 0) }],
      treeStructures: getTreeStructures(refreshedTreeData, displayArray)
    });

    expect(Array.from(initialRender.tipPositions)).toEqual([0.1, 0.9, 0.9, 0.9]);
    expect(Array.from(refreshedRender.tipPositions)).toEqual([0.4, 0.9, 0.95, 0.9]);
  });

  it('creates independent caches that support compute then apply-transform', () => {
    const cache = createRenderDataCache();
    const treeData = makeTreeData({ treeIdx: 8, tipXs: [0.25, 0.75] });
    const displayArray = [8];
    const treeStructures = getTreeStructures(treeData, displayArray);

    cache.computeRenderArrays({
      node_id: treeData.node_id,
      parent_id: treeData.parent_id,
      is_tip: treeData.is_tip,
      tree_idx: treeData.tree_idx,
      x: treeData.x,
      y: treeData.y,
      name: treeData.name,
      mut_x: treeData.mut_x,
      mut_y: treeData.mut_y,
      mut_tree_idx: treeData.mut_tree_idx,
      modelMatrices: [{ key: 8, modelMatrix: modelMatrix(1, 0) }],
      displayArray,
      treeStructures
    });

    const transformed = cache.applyTransform({
      modelMatrices: [{ key: 8, modelMatrix: modelMatrix(2, 1) }],
      treeStructures
    });

    expect(transformed.cacheMiss).toBeUndefined();
    expect(Array.from(transformed.tipPositions)).toEqual([1.5, 0.9, 2.5, 0.9]);
  });

  it('keeps factory cache instances isolated', () => {
    const cacheA = createRenderDataCache();
    const cacheB = createRenderDataCache();
    const treeA = makeTreeData({ treeIdx: 10 });
    const treeB = makeTreeData({ treeIdx: 11 });

    cacheA.computeRenderArrays({
      node_id: treeA.node_id,
      parent_id: treeA.parent_id,
      is_tip: treeA.is_tip,
      tree_idx: treeA.tree_idx,
      x: treeA.x,
      y: treeA.y,
      name: treeA.name,
      mut_x: treeA.mut_x,
      mut_y: treeA.mut_y,
      mut_tree_idx: treeA.mut_tree_idx,
      modelMatrices: [{ key: 10, modelMatrix: modelMatrix(1, 0) }],
      displayArray: [10],
      treeStructures: getTreeStructures(treeA, [10])
    });
    cacheB.computeRenderArrays({
      node_id: treeB.node_id,
      parent_id: treeB.parent_id,
      is_tip: treeB.is_tip,
      tree_idx: treeB.tree_idx,
      x: treeB.x,
      y: treeB.y,
      name: treeB.name,
      mut_x: treeB.mut_x,
      mut_y: treeB.mut_y,
      mut_tree_idx: treeB.mut_tree_idx,
      modelMatrices: [{ key: 11, modelMatrix: modelMatrix(1, 0) }],
      displayArray: [11],
      treeStructures: getTreeStructures(treeB, [11])
    });

    expect(cacheA.applyTransform({
      modelMatrices: [{ key: 10, modelMatrix: modelMatrix(1, 0) }],
      treeStructures: getTreeStructures(treeA, [10])
    }).cacheMiss).toBeUndefined();
    expect(cacheB.applyTransform({
      modelMatrices: [{ key: 10, modelMatrix: modelMatrix(1, 0) }],
      treeStructures: getTreeStructures(treeA, [10])
    }).cacheMiss).toBe(true);
  });

  it('clears factory cache buffers', () => {
    const cache = createRenderDataCache();
    const treeData = makeTreeData({ treeIdx: 12 });
    const displayArray = [12];
    const treeStructures = getTreeStructures(treeData, displayArray);

    cache.computeRenderArrays({
      node_id: treeData.node_id,
      parent_id: treeData.parent_id,
      is_tip: treeData.is_tip,
      tree_idx: treeData.tree_idx,
      x: treeData.x,
      y: treeData.y,
      name: treeData.name,
      mut_x: treeData.mut_x,
      mut_y: treeData.mut_y,
      mut_tree_idx: treeData.mut_tree_idx,
      modelMatrices: [{ key: 12, modelMatrix: modelMatrix(1, 0) }],
      displayArray,
      treeStructures
    });
    cache.clearBuffers();

    expect(cache.applyTransform({
      modelMatrices: [{ key: 12, modelMatrix: modelMatrix(1, 0) }],
      treeStructures
    }).cacheMiss).toBe(true);
  });
});
