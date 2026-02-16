import { beforeEach, describe, expect, it } from 'vitest';

import {
  computeRenderArrays,
  applyTransform,
  clearWorkerState
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
});
