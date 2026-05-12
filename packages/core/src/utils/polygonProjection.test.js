import { describe, expect, it } from 'vitest';

import { computePolygonVertices } from './polygonProjection.js';

function makeViewport() {
  return {
    height: 100,
    project: ([x, y]) => [x, y * 100]
  };
}

describe('computePolygonVertices', () => {
  it('uses clipped visible interval bounds for polygon top vertices', () => {
    const vertices = computePolygonVertices(
      {
        s: 0,
        e: 100,
        visible_s: 25,
        visible_e: 75,
        visible: true,
        modelMatrix: [10, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 40, 0, 0, 1]
      },
      makeViewport(),
      makeViewport(),
      1
    );

    expect(vertices).toBeTruthy();
    expect(vertices[1][0]).toBe(25);
    expect(vertices[2][0]).toBe(75);
  });
});
