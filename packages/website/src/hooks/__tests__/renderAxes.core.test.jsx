/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { computeRenderArrays as computeRenderArraysWorker } from '@lorax/core/src/workers/renderDataWorker.js';
import { serializeModelMatrices } from '@lorax/core/src/utils/renderUtils.js';

function createModelMatrix({ scaleX, translateX, scaleY = 1, translateY = 0 }) {
  const m = new Array(16).fill(0);
  m[0] = scaleX;
  m[5] = scaleY;
  m[12] = translateX;
  m[13] = translateY;
  return m;
}

function createInput() {
  return {
    node_id: [0, 1],
    parent_id: [-1, 0],
    is_tip: [false, true],
    tree_idx: [0, 0],
    x: [0.25, 0.75], // layout/horizontal
    y: [0.1, 0.9], // time/vertical
    name: ['', 'tip-a'],
    mut_x: [0.6],
    mut_y: [0.4],
    mut_tree_idx: [0],
    displayArray: [0],
    metadataArrays: null,
    metadataColors: null,
    populationFilter: null,
  };
}

describe('render array axis mapping', () => {
  it('uses canonical axes in worker computeRenderArrays (x horizontal, y vertical/time)', () => {
    const modelMatrix = createModelMatrix({ scaleX: 10, translateX: 100 });

    const result = computeRenderArraysWorker({
      ...createInput(),
      modelMatrices: [{ key: 0, modelMatrix }],
    });

    expect(Array.from(result.pathPositions)).toEqual([
      102.5, 0.1,
      107.5, 0.1,
      107.5, 0.9,
    ]);
    expect(Array.from(result.tipPositions)).toEqual([107.5, 0.9]);
    expect(Array.from(result.mutPositions)).toEqual([106, 0.4]);
    expect(result.edgeData).toHaveLength(1);
    expect(result.edgeData[0]).toMatchObject({ parent_id: 0, child_id: 1, tree_idx: 0 });
  });

  it('serializes only visible model matrices for worker payloads', () => {
    const localBins = new Map([
      [0, { modelMatrix: createModelMatrix({ scaleX: 2, translateX: 10 }) }],
      [1, { modelMatrix: createModelMatrix({ scaleX: 3, translateX: 20 }), visible: false }],
      [2, { modelMatrix: createModelMatrix({ scaleX: 4, translateX: 30 }) }],
    ]);

    const serialized = serializeModelMatrices(localBins);
    expect(serialized).toHaveLength(2);
    expect(serialized.map((entry) => entry.key)).toEqual([0, 2]);
  });
});
