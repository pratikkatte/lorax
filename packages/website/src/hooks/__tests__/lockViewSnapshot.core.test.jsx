/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { buildLockViewSnapshot } from '@lorax/core/src/utils/lockViewSnapshot.js';

function createModelMatrix({
  scaleX,
  translateX,
  scaleY = 1,
  translateY = 0
}) {
  const m = new Array(16).fill(0);
  m[0] = scaleX;
  m[5] = scaleY;
  m[12] = translateX;
  m[13] = translateY;
  return m;
}

function createViewport({
  width = 100,
  height = 50,
  offsetX = 0,
  offsetY = 0
} = {}) {
  return {
    width,
    height,
    unproject: ([x, y]) => [x + offsetX, y + offsetY, 0]
  };
}

describe('buildLockViewSnapshot', () => {
  it('captures tree-local corners in fixed order with world-space bounding box', () => {
    const localBins = new Map([
      [3, { global_index: 3, modelMatrix: createModelMatrix({ scaleX: 20, translateX: 0, scaleY: 2, translateY: 10 }) }],
      [7, { global_index: 7, modelMatrix: createModelMatrix({ scaleX: 20, translateX: 80, scaleY: 4, translateY: -10 }) }]
    ]);

    const snapshot = buildLockViewSnapshot({
      orthoViewport: createViewport({ width: 100, height: 50 }),
      localBins
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot.coordinateSystem).toBe('tree-local-nearest');
    expect(typeof snapshot.capturedAt).toBe('number');
    expect(snapshot.corners.map((c) => c.corner)).toEqual([
      'topLeft',
      'topRight',
      'bottomRight',
      'bottomLeft'
    ]);

    expect(snapshot.corners[0]).toMatchObject({ x: 0, y: -5, treeIndex: 3 });
    expect(snapshot.corners[1]).toMatchObject({ x: 1, y: 2.5, treeIndex: 7 });
    expect(snapshot.corners[2]).toMatchObject({ x: 1, y: 15, treeIndex: 7 });
    expect(snapshot.corners[3]).toMatchObject({ x: 0, y: 20, treeIndex: 3 });

    expect(snapshot.boundingBox).toEqual({
      minX: 0,
      maxX: 100,
      minY: 0,
      maxY: 50,
      width: 100,
      height: 50
    });
    expect(snapshot.inBoxTreeIndices).toEqual([3, 7]);
    expect(snapshot.inBoxTreeCount).toBe(2);
    expect(snapshot.displayArraySignature).toBe('3,7');
    expect(snapshot.targetLocalBBox).toBeNull();
    expect(snapshot.adaptiveTarget).toBeNull();
  });

  it('does not assign trees when no tree range intersects the viewport box', () => {
    const localBins = new Map([
      [1, { global_index: 1, modelMatrix: createModelMatrix({ scaleX: 10, translateX: 0, scaleY: 1, translateY: 0 }) }],
      [2, { global_index: 2, modelMatrix: createModelMatrix({ scaleX: 10, translateX: 30, scaleY: 1, translateY: 0 }) }]
    ]);

    const snapshot = buildLockViewSnapshot({
      orthoViewport: createViewport({ width: 10, height: 10, offsetX: 100 }),
      localBins
    });

    expect(snapshot).not.toBeNull();
    for (const corner of snapshot.corners) {
      expect(corner.treeIndex).toBeNull();
      expect(corner.x).toBeNull();
      expect(corner.y).toBeNull();
    }
    expect(snapshot.inBoxTreeIndices).toEqual([]);
    expect(snapshot.inBoxTreeCount).toBe(0);
    expect(snapshot.adaptiveTarget).toBeNull();
  });

  it('emits single-target adaptive payload when all corners map to one tree', () => {
    const localBins = new Map([
      [10, { global_index: 10, modelMatrix: createModelMatrix({ scaleX: 10, translateX: -30, scaleY: 1, translateY: 0 }) }],
      [20, { global_index: 20, modelMatrix: createModelMatrix({ scaleX: 20, translateX: 40, scaleY: 1, translateY: 0 }) }]
    ]);

    const snapshot = buildLockViewSnapshot({
      orthoViewport: createViewport({ width: 100, height: 20 }),
      localBins
    });

    expect(snapshot).not.toBeNull();
    for (const corner of snapshot.corners) {
      expect(corner.treeIndex).toBe(20);
    }
    expect(snapshot.inBoxTreeIndices).toEqual([20]);
    expect(snapshot.inBoxTreeCount).toBe(1);
    expect(snapshot.displayArraySignature).toBe('10,20');
    expect(snapshot.targetLocalBBox).toEqual({
      treeIndex: 20,
      minX: -2,
      maxX: 3,
      minY: 0,
      maxY: 20
    });
    expect(snapshot.adaptiveTarget).toEqual({
      treeIndex: 20,
      coverageX: 1,
      coverageY: 1,
      coverageArea: 1,
      profile: 'balanced'
    });
  });

  it('computes x-overlap adaptive coverage for a single target', () => {
    const localBins = new Map([
      [1, { global_index: 1, modelMatrix: createModelMatrix({ scaleX: 20, translateX: 90, scaleY: 1, translateY: 0 }) }]
    ]);

    const snapshot = buildLockViewSnapshot({
      orthoViewport: createViewport({ width: 100, height: 20 }),
      localBins
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot.inBoxTreeIndices).toEqual([1]);
    expect(snapshot.inBoxTreeCount).toBe(1);
    expect(snapshot.targetLocalBBox).toEqual({
      treeIndex: 1,
      minX: -4.5,
      maxX: 0.5,
      minY: 0,
      maxY: 20
    });
    expect(snapshot.adaptiveTarget).toEqual({
      treeIndex: 1,
      coverageX: 0.5,
      coverageY: 1,
      coverageArea: 0.5,
      profile: 'balanced'
    });
  });

  it('returns null treeIndex and null local coordinates when no visible trees exist', () => {
    const localBins = new Map([
      [5, { global_index: 5, modelMatrix: null }],
      [8, { global_index: 8 }]
    ]);

    const snapshot = buildLockViewSnapshot({
      orthoViewport: createViewport({ width: 20, height: 10 }),
      localBins
    });

    expect(snapshot).not.toBeNull();
    for (const corner of snapshot.corners) {
      expect(corner.treeIndex).toBeNull();
      expect(corner.x).toBeNull();
      expect(corner.y).toBeNull();
    }
    expect(snapshot.inBoxTreeIndices).toEqual([]);
    expect(snapshot.inBoxTreeCount).toBe(0);
    expect(snapshot.adaptiveTarget).toBeNull();
  });
});
