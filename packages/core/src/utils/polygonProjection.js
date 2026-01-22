/**
 * polygonProjection.js
 * Pure utility functions for computing cross-viewport trapezoid polygon vertices
 * for tree visualization overlays.
 */

/**
 * Easing functions for animation interpolation
 */
export const easingFunctions = {
  linear: (t) => t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
};

/**
 * Compute the 6-vertex trapezoid polygon for a tree bin.
 * The polygon connects:
 * - Top edge: the genomic interval span (at ortho view top / genome-info bottom)
 * - Body: narrows to the tree's display position in the ortho view
 * - Bottom edge: the tree's width at the bottom of the ortho view
 *
 * @param {Object} bin - Tree bin with s, e, modelMatrix, visible properties
 * @param {Object} genomeVP - deck.gl viewport for genome-info view
 * @param {Object} orthoVP - deck.gl viewport for ortho view
 * @param {number} globalBpPerUnit - Base pairs per world unit
 * @returns {Array<[number, number]>|null} - 6-vertex polygon or null if bin not visible
 */
export function computePolygonVertices(bin, genomeVP, orthoVP, globalBpPerUnit) {
  // Check visibility - treat undefined/missing as visible (same as useRenderData)
  if (bin?.visible === false || !bin?.modelMatrix || !genomeVP || !orthoVP) {
    return null;
  }

  const modelMatrix = bin.modelMatrix;
  // Project genome coordinates to screen space via genome viewport
  const pixel_s = genomeVP.project([bin.s / globalBpPerUnit, 0]);
  const pixel_e = genomeVP.project([bin.e / globalBpPerUnit, 0]);

  // Project model matrix bounds to screen space via ortho viewport
  // modelMatrix[12] = x translation, modelMatrix[0] = x scale
  const [x0, _y0] = orthoVP.project([modelMatrix[12], 0]);
  const [x1, _y1] = orthoVP.project([modelMatrix[12] + modelMatrix[0], 1]);

  // Get ortho view bounds in screen coordinates
  // orthoVP.y is the top of the ortho view in pixels from canvas top
  // orthoVP.height is the height of the ortho view
  const orthoTop = 0;
  const orthoHeight = orthoVP.height;

  // Calculate the "neck" position - where the trapezoid narrows from genome span to tree width
  // This is 10% down from the ortho top
  const neckY = orthoTop + orthoHeight * 0.1;

  // Return 6-vertex trapezoid:
  // The polygon connects genome interval (at ortho top) to tree display (narrower)
  return [
    [x0, neckY],            // 1: Left neck (tree left at 10% down)
    [pixel_s[0], orthoTop], // 2: Genome interval start (at ortho top)
    [pixel_e[0], orthoTop], // 3: Genome interval end (at ortho top)
    [x1, neckY],            // 4: Right neck (tree right at 10% down)
    [x1, _y1],      // 5: Bottom-right (at ortho bottom)
    [x0, _y1]       // 6: Bottom-left (at ortho bottom)
  ];
}

/**
 * Check if a polygon is visible within the viewport bounds using AABB test.
 *
 * @param {Array<[number, number]>} vertices - Polygon vertices
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 * @returns {boolean} - True if polygon intersects viewport
 */
export function isPolygonVisible(vertices, width, height) {
  if (!vertices || vertices.length === 0) return false;

  // Compute AABB of polygon
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const [x, y] of vertices) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  // Check intersection with viewport (0,0) to (width, height)
  return maxX >= 0 && minX <= width && maxY >= 0 && minY <= height;
}

/**
 * Linearly interpolate between two sets of polygon vertices.
 * Used for smooth animation transitions.
 *
 * @param {Array<[number, number]>} verticesA - Starting vertices
 * @param {Array<[number, number]>} verticesB - Target vertices
 * @param {number} progress - Interpolation progress (0 to 1)
 * @returns {Array<[number, number]>} - Interpolated vertices
 */
export function interpolateVertices(verticesA, verticesB, progress) {
  if (!verticesA || !verticesB) return verticesB || verticesA;
  if (verticesA.length !== verticesB.length) return verticesB;

  return verticesA.map(([ax, ay], i) => {
    const [bx, by] = verticesB[i];
    return [
      ax + (bx - ax) * progress,
      ay + (by - ay) * progress
    ];
  });
}

/**
 * Batch compute polygon vertices for multiple bins.
 *
 * @param {Map} bins - Map of tree bins
 * @param {Object} genomeVP - deck.gl viewport for genome-positions view
 * @param {Object} orthoVP - deck.gl viewport for ortho view
 * @param {number} globalBpPerUnit - Base pairs per world unit
 * @returns {Array<{key: string|number, vertices: Array, treeIndex: number}>}
 */
export function computeAllPolygons(bins, genomeVP, orthoVP, globalBpPerUnit) {
  if (!(bins instanceof Map) || !genomeVP || !orthoVP) {
    return [];
  }

  const polygons = [];

  for (const [key, bin] of bins) {
    const vertices = computePolygonVertices(bin, genomeVP, orthoVP, globalBpPerUnit);
    if (vertices) {
      polygons.push({
        key,
        vertices,
        treeIndex: bin.global_index
      });
    }
  }

  return polygons;
}
