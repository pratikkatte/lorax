import { beforeEach, describe, expect, it } from 'vitest';

import {
  setColorContext,
  computeBaseRenderData,
  applyModelMatrices,
  evictBaseCache,
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

describe('renderDataWorker base cache protocol', () => {
  beforeEach(() => {
    clearWorkerState();
    setColorContext({ metadataArrays: null, metadataColors: null });
  });

  it('computes base data and applies model matrices correctly', () => {
    const treeData = makeTreeData({ treeIdx: 7, rootX: 0.5, tipXs: [0.2, 0.8], mutX: 0.6 });

    const computeResult = computeBaseRenderData({
      treeData,
      displayArray: [7],
      targetTreeIndices: [7]
    });

    expect(computeResult.cachedTreeIndices).toEqual([7]);
    expect(computeResult.skippedTreeIndices).toEqual([]);

    const render = applyModelMatrices({
      displayArray: [7],
      modelMatrices: [{ key: 7, modelMatrix: modelMatrix(2, 10) }],
      populationFilter: null
    });

    expect(render.edgeCount).toBe(2);
    expect(render.tipCount).toBe(2);
    expect(render.mutCount).toBe(1);
    expect(Array.from(render.pathStartIndices)).toEqual([0, 3, 6]);
    expect(Array.from(render.tipPositions)).toEqual([10.4, 0.9, 11.6, 0.9]);
    expect(Array.from(render.mutPositions)).toEqual([11.2, 0.4]);
    expect(render.tipData[0].position).toEqual([10.4, 0.9]);
    expect(render.tipData[1].position).toEqual([11.6, 0.9]);
  });

  it('supports matrix-only pan/zoom updates without recomputing base data', () => {
    const treeData = makeTreeData({ treeIdx: 4, tipXs: [0.1, 0.9] });

    computeBaseRenderData({
      treeData,
      displayArray: [4],
      targetTreeIndices: [4]
    });

    const renderA = applyModelMatrices({
      displayArray: [4],
      modelMatrices: [{ key: 4, modelMatrix: modelMatrix(1, 0) }],
      populationFilter: null
    });

    const renderB = applyModelMatrices({
      displayArray: [4],
      modelMatrices: [{ key: 4, modelMatrix: modelMatrix(3, -1) }],
      populationFilter: null
    });

    expect(Array.from(renderA.tipPositions)).toEqual([0.1, 0.9, 0.9, 0.9]);
    expect(Array.from(renderB.tipPositions)).toEqual([-0.7, 0.9, 1.7000000000000002, 0.9]);
    expect(renderB.edgeCount).toBe(renderA.edgeCount);
  });

  it('recolors tips during apply-model-matrices using worker color context', () => {
    const treeData = makeTreeData({
      treeIdx: 9,
      tipNodeIds: [11, 12]
    });

    setColorContext({
      metadataArrays: {
        pop: {
          uniqueValues: ['A', 'B'],
          indices: [0, 1],
          nodeIdToIdx: new Map([
            [11, 0],
            [12, 1]
          ])
        }
      },
      metadataColors: {
        pop: {
          A: [1, 2, 3, 255],
          B: [4, 5, 6, 255]
        }
      }
    });

    computeBaseRenderData({
      treeData,
      displayArray: [9],
      targetTreeIndices: [9]
    });

    const render = applyModelMatrices({
      displayArray: [9],
      modelMatrices: [{ key: 9, modelMatrix: modelMatrix(1, 0) }],
      populationFilter: {
        colorBy: 'pop',
        enabledValues: ['A']
      }
    });

    expect(Array.from(render.tipColors)).toEqual([
      1, 2, 3, 200,
      150, 150, 150, 100
    ]);
  });

  it('evicts trees from worker base cache', () => {
    const treeData = {
      ...makeTreeData({ treeIdx: 1, rootNodeId: 10, tipNodeIds: [11, 12] }),
      node_id: [10, 11, 12, 20, 21, 22],
      parent_id: [-1, 10, 10, -1, 20, 20],
      is_tip: [false, true, true, false, true, true],
      tree_idx: [1, 1, 1, 2, 2, 2],
      x: [0.5, 0.2, 0.8, 0.4, 0.1, 0.9],
      y: [0.1, 0.9, 0.9, 0.2, 0.8, 0.8],
      name: ['', 'a', 'b', '', 'c', 'd'],
      mut_x: [0.6, 0.7],
      mut_y: [0.4, 0.3],
      mut_tree_idx: [1, 2]
    };

    computeBaseRenderData({
      treeData,
      displayArray: [1, 2],
      targetTreeIndices: [1, 2]
    });

    const evictResult = evictBaseCache({ treeIndices: [1] });
    expect(evictResult.evictedCount).toBe(1);

    const render = applyModelMatrices({
      displayArray: [1, 2],
      modelMatrices: [
        { key: 1, modelMatrix: modelMatrix(1, 0) },
        { key: 2, modelMatrix: modelMatrix(1, 0) }
      ],
      populationFilter: null
    });

    expect(render.tipCount).toBe(2);
    expect(render.edgeCount).toBe(2);
    expect(render.tipData.every((tip) => tip.tree_idx === 2)).toBe(true);
  });

  it('replaces cached base data when an existing tree is recomputed', () => {
    const initialTreeData = makeTreeData({ treeIdx: 3, tipXs: [0.1, 0.9] });
    const refreshedTreeData = makeTreeData({ treeIdx: 3, tipXs: [0.4, 0.95] });

    computeBaseRenderData({
      treeData: initialTreeData,
      displayArray: [3],
      targetTreeIndices: [3]
    });

    const initialRender = applyModelMatrices({
      displayArray: [3],
      modelMatrices: [{ key: 3, modelMatrix: modelMatrix(1, 0) }],
      populationFilter: null
    });

    computeBaseRenderData({
      treeData: refreshedTreeData,
      displayArray: [3],
      targetTreeIndices: [3]
    });

    const refreshedRender = applyModelMatrices({
      displayArray: [3],
      modelMatrices: [{ key: 3, modelMatrix: modelMatrix(1, 0) }],
      populationFilter: null
    });

    expect(Array.from(initialRender.tipPositions)).toEqual([0.1, 0.9, 0.9, 0.9]);
    expect(Array.from(refreshedRender.tipPositions)).toEqual([0.4, 0.9, 0.95, 0.9]);
  });
});
