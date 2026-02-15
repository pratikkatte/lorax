/**
 * Build a lock-view ortho snapshot payload.
 *
 * Payload shape:
 * {
 *   capturedAt: number,
 *   coordinateSystem: 'tree-local-nearest',
 *   corners: [
 *     { corner: 'topLeft'|'topRight'|'bottomRight'|'bottomLeft', x, y, treeIndex }
 *   ],
 *   // NOTE: boundingBox is in world coordinates.
 *   boundingBox: { minX, maxX, minY, maxY, width, height },
 *   inBoxTreeIndices: number[],
 *   inBoxTreeCount: number,
 *   adaptiveTarget?: {
 *     treeIndex: number,
 *     coverageX: number,
 *     coverageY: number,
 *     coverageArea: number,
 *     profile: 'balanced'
 *   },
 *   displayArraySignature: string
 * }
 */

const CORNERS = [
  { corner: 'topLeft', getPixel: (width, _height) => [0, 0] },
  { corner: 'topRight', getPixel: (width, _height) => [width, 0] },
  { corner: 'bottomRight', getPixel: (width, height) => [width, height] },
  { corner: 'bottomLeft', getPixel: (_width, height) => [0, height] }
];

function getMatrixComponent(modelMatrix, index) {
  if (Array.isArray(modelMatrix) || ArrayBuffer.isView(modelMatrix)) {
    return Number(modelMatrix[index]);
  }
  const elements = modelMatrix?.elements;
  if (Array.isArray(elements) || ArrayBuffer.isView(elements)) {
    return Number(elements[index]);
  }
  return Number.NaN;
}

function buildVisibleTreeRanges(localBins) {
  if (!(localBins instanceof Map)) return [];

  const ranges = [];
  for (const [key, bin] of localBins.entries()) {
    const modelMatrix = bin?.modelMatrix;
    if (!modelMatrix) continue;

    const scaleX = getMatrixComponent(modelMatrix, 0);
    const scaleY = getMatrixComponent(modelMatrix, 5);
    const translateX = getMatrixComponent(modelMatrix, 12);
    const translateY = getMatrixComponent(modelMatrix, 13);
    if (
      !Number.isFinite(scaleX)
      || !Number.isFinite(scaleY)
      || !Number.isFinite(translateX)
      || !Number.isFinite(translateY)
    ) {
      continue;
    }

    const rawTreeIndex = Number.isFinite(bin?.global_index) ? bin.global_index : key;
    const treeIndex = Number(rawTreeIndex);
    if (!Number.isFinite(treeIndex)) continue;

    const x0 = translateX;
    const x1 = translateX + scaleX;
    const y0 = translateY;
    const y1 = translateY + scaleY;

    ranges.push({
      treeIndex,
      minX: Math.min(x0, x1),
      maxX: Math.max(x0, x1),
      minY: Math.min(y0, y1),
      maxY: Math.max(y0, y1),
      scaleX,
      scaleY,
      translateX,
      translateY
    });
  }

  return ranges;
}

function nearestTreeRangeForX(x, ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0 || !Number.isFinite(x)) return null;

  let best = null;
  let bestDistance = Infinity;

  for (const range of ranges) {
    const minX = range?.minX;
    const maxX = range?.maxX;
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) continue;

    let distance = 0;
    if (x < minX) distance = minX - x;
    else if (x > maxX) distance = x - maxX;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = range;
    }
  }

  return best;
}

function filterRangesInsideViewportX(ranges, minX, maxX) {
  if (!Array.isArray(ranges) || ranges.length === 0) return [];
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return [];

  return ranges.filter((range) => {
    const rangeMinX = range?.minX;
    const rangeMaxX = range?.maxX;
    if (!Number.isFinite(rangeMinX) || !Number.isFinite(rangeMaxX)) return false;
    return rangeMaxX >= minX && rangeMinX <= maxX;
  });
}

function toWorldXY(unprojected) {
  if (Array.isArray(unprojected)) {
    return { x: Number(unprojected[0]), y: Number(unprojected[1]) };
  }
  if (unprojected && typeof unprojected === 'object') {
    return { x: Number(unprojected.x), y: Number(unprojected.y) };
  }
  return { x: Number.NaN, y: Number.NaN };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function overlapLength(aMin, aMax, bMin, bMax) {
  if (
    !Number.isFinite(aMin) || !Number.isFinite(aMax)
    || !Number.isFinite(bMin) || !Number.isFinite(bMax)
  ) {
    return 0;
  }
  const lo = Math.max(Math.min(aMin, aMax), Math.min(bMin, bMax));
  const hi = Math.min(Math.max(aMin, aMax), Math.max(bMin, bMax));
  return Math.max(0, hi - lo);
}

function buildInBoxTreeIndicesFromCorners(corners) {
  if (!Array.isArray(corners) || corners.length === 0) return [];
  const indices = [];
  const seen = new Set();

  for (const corner of corners) {
    const rawTreeIndex = corner?.treeIndex;
    if (rawTreeIndex == null || rawTreeIndex === '') continue;
    const treeIndex = Number(rawTreeIndex);
    if (!Number.isFinite(treeIndex) || seen.has(treeIndex)) continue;
    seen.add(treeIndex);
    indices.push(treeIndex);
  }

  return indices;
}

function computeSingleTargetAdaptiveTarget({ targetTreeIndex, treeRanges, boundingBox }) {
  if (!Array.isArray(treeRanges) || !boundingBox) return null;
  const targetIndex = Number(targetTreeIndex);
  if (!Number.isFinite(targetIndex)) return null;

  const range = treeRanges.find((entry) => Number(entry?.treeIndex) === targetIndex);
  if (!range) return null;

  const treeWidth = Math.max(1e-12, Math.abs(range.maxX - range.minX));
  const overlapX = overlapLength(
    boundingBox.minX,
    boundingBox.maxX,
    range.minX,
    range.maxX
  );
  const coverageX = clamp(overlapX / treeWidth, 0, 1);

  return {
    treeIndex: targetIndex,
    coverageX,
    coverageY: 1,
    coverageArea: coverageX,
    profile: 'balanced'
  };
}

function computeDisplayArraySignature(ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return '';
  const indices = [];
  const seen = new Set();

  for (const range of ranges) {
    const treeIndex = Number(range?.treeIndex);
    if (!Number.isFinite(treeIndex) || seen.has(treeIndex)) continue;
    seen.add(treeIndex);
    indices.push(treeIndex);
  }

  indices.sort((a, b) => a - b);
  return indices.join(',');
}

/**
 * Build lock-view snapshot data for current ortho viewport.
 *
 * @param {Object} params
 * @param {Object|null} params.orthoViewport - deck.gl ortho viewport
 * @param {Map|null} params.localBins - local bins with model matrices
 * @returns {Object|null} corners x/y are nearest-tree local coordinates; boundingBox is world-space
 */
export function buildLockViewSnapshot({ orthoViewport, localBins }) {
  if (!orthoViewport || typeof orthoViewport.unproject !== 'function') return null;

  const width = Number(orthoViewport.width);
  const height = Number(orthoViewport.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const treeRanges = buildVisibleTreeRanges(localBins);
  const worldCorners = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const spec of CORNERS) {
    const [px, py] = spec.getPixel(width, height);
    const world = toWorldXY(orthoViewport.unproject([px, py]));
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) {
      return null;
    }

    worldCorners.push({ corner: spec.corner, worldX: world.x, worldY: world.y });

    minX = Math.min(minX, world.x);
    maxX = Math.max(maxX, world.x);
    minY = Math.min(minY, world.y);
    maxY = Math.max(maxY, world.y);
  }

  const rangesInsideBox = filterRangesInsideViewportX(treeRanges, minX, maxX);
  const displayArraySignature = computeDisplayArraySignature(treeRanges);
  const corners = [];

  for (const worldCorner of worldCorners) {
    const nearestTreeRange = nearestTreeRangeForX(worldCorner.worldX, rangesInsideBox);
    const treeIndex = nearestTreeRange?.treeIndex ?? null;

    let localX = null;
    let localY = null;

    if (nearestTreeRange) {
      const scaleX = Number(nearestTreeRange.scaleX);
      const scaleY = Number(nearestTreeRange.scaleY);
      const translateX = Number(nearestTreeRange.translateX);
      const translateY = Number(nearestTreeRange.translateY);
      const EPSILON = 1e-12;

      if (
        Number.isFinite(scaleX)
        && Number.isFinite(scaleY)
        && Number.isFinite(translateX)
        && Number.isFinite(translateY)
        && Math.abs(scaleX) > EPSILON
        && Math.abs(scaleY) > EPSILON
      ) {
        localX = (worldCorner.worldX - translateX) / scaleX;
        localY = (worldCorner.worldY - translateY) / scaleY;
      }
    }

    corners.push({
      corner: worldCorner.corner,
      x: localX,
      y: localY,
      treeIndex
    });
  }

  const boundingBox = {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };

  const inBoxTreeIndices = buildInBoxTreeIndicesFromCorners(corners);
  const inBoxTreeCount = inBoxTreeIndices.length;
  const adaptiveTarget = inBoxTreeCount === 1
    ? computeSingleTargetAdaptiveTarget({
      targetTreeIndex: inBoxTreeIndices[0],
      treeRanges,
      boundingBox
    })
    : null;

  return {
    capturedAt: Date.now(),
    coordinateSystem: 'tree-local-nearest',
    corners,
    inBoxTreeIndices,
    inBoxTreeCount,
    boundingBox,
    adaptiveTarget,
    displayArraySignature
  };
}
