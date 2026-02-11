export function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

export function upperBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function nearestIndex(arr, x) {
  if (arr.length === 0) return -1;
  if (x <= arr[0]) return 0;
  if (x >= arr[arr.length - 1]) return arr.length - 1;

  const i = lowerBound(arr, x);
  const prev = i - 1;
  return prev;
}

// ────────────────────────────────────────────────────────────────────────────
// Matrix4 class for modelMatrix computation (minimal implementation)
// Used for tree positioning transforms
// ────────────────────────────────────────────────────────────────────────────

class Matrix4 {
  constructor(values = null) {
    if (values) {
      this.elements = new Float64Array(values);
    } else {
      // Identity matrix
      this.elements = new Float64Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
    }
  }

  clone() {
    return new Matrix4(this.elements);
  }

  translate(vec) {
    const [x, y, z] = vec;
    // Apply translation to the matrix
    this.elements[12] += x;
    this.elements[13] += y;
    this.elements[14] += z;
    return this;
  }

  scale(vec) {
    const [sx, sy, sz] = vec;
    // Apply scale to the matrix
    this.elements[0] *= sx;
    this.elements[5] *= sy;
    this.elements[10] *= sz;
    return this;
  }

  toArray() {
    return Array.from(this.elements);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SELECTION STRATEGIES
// These functions determine which tree to display when multiple trees fall
// within the same visual slot during zoomed-out views.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Helper for weighted random selection
 * @param {Array} items - Array of items to select from
 * @param {Function} weightFn - Function that returns weight for each item
 * @returns {*} Selected item
 */
function weightedRandomSelect(items, weightFn) {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];

  const weights = items.map(weightFn);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) return items[0];

  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Selection strategies for choosing representative tree from a group
 */
export const selectionStrategies = {
  /**
   * Select the tree with the largest genomic span
   */
  largestSpan: (trees) => {
    if (trees.length === 0) return null;
    return trees.reduce((max, t) => (t.span > max.span ? t : max), trees[0]);
  },

  /**
   * Select the tree closest to the slot's center genomic position
   */
  centerWeighted: (trees, slotMidpoint) => {
    if (trees.length === 0) return null;
    return trees.reduce((best, t) => {
      const distBest = Math.abs(best.midpoint - slotMidpoint);
      const distCurrent = Math.abs(t.midpoint - slotMidpoint);
      return distCurrent < distBest ? t : best;
    }, trees[0]);
  },

  /**
   * Random selection weighted by genomic span (larger spans more likely)
   */
  spanWeightedRandom: (trees) => {
    return weightedRandomSelect(trees, t => t.span);
  },

  /**
   * Select the first tree (by genomic position)
   */
  first: (trees) => {
    if (trees.length === 0) return null;
    return trees.reduce((first, t) => (t.s < first.s ? t : first), trees[0]);
  }
};

/**
 * Get selection strategy function by name
 */
export function getSelectionStrategy(strategyName) {
  return selectionStrategies[strategyName] || selectionStrategies.largestSpan;
}

/**
 * Compute precision level based on group size and scale factor
 * Higher precision (more detail) when fewer trees are grouped
 */
function computePrecisionFromGroupSize(groupSize, scaleFactor) {
  if (groupSize === 1 && scaleFactor <= 1) {
    return 3; // Maximum precision for single trees at full zoom
  }

  // Reduce precision as group size increases
  const logGroup = Math.log10(Math.max(1, groupSize));
  const logScale = Math.log10(Math.max(1, scaleFactor));

  // Map to precision range [1, 3]
  const precision = Math.max(1, Math.min(3, 3 - Math.floor(logGroup + logScale / 2)));
  return precision;
}

/**
 * Grid-based binning with configurable selection and fixed visual width
 *
 * @param {Map} localBins - Map of tree index -> bin data { s, e, path, global_index, precision }
 * @param {number} globalBpPerUnit - Base pairs per unit (for coordinate conversion)
 * @param {number} new_globalBp - Zoom-adjusted bp per unit
 * @param {Object} options - Configuration options
 * @param {string} options.selectionStrategy - Strategy name: 'largestSpan', 'centerWeighted', 'spanWeightedRandom', 'first'
 * @param {number|null} options.viewportStart - Start of visible viewport in genomic coordinates (bp)
 * @param {number|null} options.viewportEnd - End of visible viewport in genomic coordinates (bp)
 * @returns {Object} { return_local_bins, displayArray, showingAllTrees }
 */
export function new_complete_experiment_map(localBins, globalBpPerUnit, new_globalBp, options = {}) {
  const {
    selectionStrategy = 'largestSpan',
    viewportStart = null,
    viewportEnd = null,
    prevLocalBins = null,  // Previous frame's localBins Map for position locking
    minStart: inputMinStart = null,
    maxEnd: inputMaxEnd = null
  } = options;

  const invisibleKeys = new Set();
  const spacing = 1.05;
  const displayArray = [];

  const numTrees = localBins.size;
  if (numTrees === 0) {
    return { return_local_bins: localBins, displayArray, showingAllTrees: false };
  }

  const scaleFactor = new_globalBp / globalBpPerUnit;
  const approxEqual = scaleFactor < 1;

  const selectFn = getSelectionStrategy(selectionStrategy);

  // Preallocate a reusable Matrix4 to avoid GC churn
  const tempMatrix = new Matrix4();

  // Use provided bounds or fall back to scan
  // localBins is inserted in sorted order, so first/last entries give min/max
  let minStart = inputMinStart;
  let maxEnd = inputMaxEnd;
  if (minStart === null || maxEnd === null) {
    minStart = Infinity;
    maxEnd = -Infinity;
    for (const bin of localBins.values()) {
      if (bin.s < minStart) minStart = bin.s;
      if (bin.e > maxEnd) maxEnd = bin.e;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Calculate fixed visual width and slot count
  // ────────────────────────────────────────────────────────────────────────

  const maxVisibleTrees = 10;
  const effectiveMaxTrees = approxEqual
    ? numTrees
    : Math.max(1, Math.max(maxVisibleTrees, Math.ceil(numTrees / scaleFactor)));

  const numSlots = Math.min(numTrees, effectiveMaxTrees);

  const showingAllTrees = approxEqual;

  // ────────────────────────────────────────────────────────────────────────
  // When scaleFactor ≈ 1, show ALL trees with uniform width
  // Iterates Map directly with a counter (already sorted by insertion order)
  // ────────────────────────────────────────────────────────────────────────
  if (approxEqual) {
    const fullZoomGapFill = 0.9;

    const effectiveStart = viewportStart ?? minStart;
    const effectiveEnd = viewportEnd ?? maxEnd;
    const visibleUnits = (effectiveEnd - effectiveStart) / globalBpPerUnit;
    const uniformTreeWidth = (visibleUnits / numTrees) * fullZoomGapFill;

    const slotWidth = (effectiveEnd - effectiveStart) / numTrees;

    let i = 0;
    for (const [key, bin] of localBins.entries()) {
      // Single tree position lock: reuse cached position if available
      if (numTrees === 1 && prevLocalBins && prevLocalBins.has(key)) {
        const prevBin = prevLocalBins.get(key);
        localBins.set(key, { ...prevBin });
      } else {
        // Calculate new position
        const slotCenter = effectiveStart + (i + 0.5) * slotWidth;
        const translateX = (slotCenter / globalBpPerUnit) - (uniformTreeWidth / 2);

        const modelMatrix = tempMatrix.clone()
          .translate([translateX, 0, 0])
          .scale([uniformTreeWidth, 1, 1]);

        localBins.set(key, {
          ...bin,
          modelMatrix,
          visible: true,
          position: bin.s,
          span: bin.span,
          precision: 2,
          slotIndex: i,
          isRepresentative: true,
          groupSize: 1
        });
      }

      displayArray.push(key);
      i++;
    }

    return { return_local_bins: localBins, displayArray, showingAllTrees };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Assign trees to slots based on their midpoint (zoomed out)
  // Use viewport bounds for positioning so trees fill the visible area
  // ────────────────────────────────────────────────────────────────────────
  const effectiveStart = viewportStart ?? minStart;
  const effectiveEnd = viewportEnd ?? maxEnd;
  const effectiveSpan = effectiveEnd - effectiveStart;
  const effectiveSlotWidth = effectiveSpan / numSlots;

  const slots = new Map();

  for (const bin of localBins.values()) {
    // Assign slot based on tree position relative to viewport
    const slotIndex = Math.min(
      numSlots - 1,
      Math.max(0, Math.floor((bin.midpoint - effectiveStart) / effectiveSlotWidth))
    );

    if (!slots.has(slotIndex)) {
      slots.set(slotIndex, []);
    }
    slots.get(slotIndex).push(bin);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Select representative tree for each slot and compute transforms
  // ────────────────────────────────────────────────────────────────────────
  const selectedKeys = new Set();

  const slotVisualWidth = effectiveSlotWidth / globalBpPerUnit;
  const treeVisualWidth = slotVisualWidth / spacing;

  for (const [slotIndex, treesInSlot] of slots.entries()) {
    const slotStart = effectiveStart + slotIndex * effectiveSlotWidth;
    const slotMidpoint = slotStart + effectiveSlotWidth / 2;

    let selectedBin;
    if (selectionStrategy === 'centerWeighted') {
      selectedBin = selectFn(treesInSlot, slotMidpoint);
    } else {
      selectedBin = selectFn(treesInSlot);
    }

    if (selectedBin) {
      const selectedKey = selectedBin.global_index;
      selectedKeys.add(selectedKey);

      const precision = computePrecisionFromGroupSize(treesInSlot.length, scaleFactor);

      const slotCenterWorld = slotMidpoint / globalBpPerUnit;
      const translateX = slotCenterWorld - treeVisualWidth / 2;

      const modelMatrix = tempMatrix.clone()
        .translate([translateX, 0, 0])
        .scale([treeVisualWidth, 1, 1]);

      localBins.set(selectedKey, {
        ...selectedBin,
        modelMatrix,
        visible: true,
        position: selectedBin.s,
        span: selectedBin.span,
        precision,
        slotIndex,
        isRepresentative: true,
        groupSize: treesInSlot.length
      });

      displayArray.push(selectedKey);
    }

    // Mark non-selected trees as invisible
    for (const bin of treesInSlot) {
      if (!selectedKeys.has(bin.global_index)) {
        invisibleKeys.add(bin.global_index);
        localBins.set(bin.global_index, {
          ...bin,
          modelMatrix: null,
          visible: false,
          position: null,
          span: null,
          path: null,
          precision: null,
          slotIndex,
          isRepresentative: false,
          groupSize: treesInSlot.length
        });
      }
    }
  }

  return { return_local_bins: localBins, displayArray, invisibleKeys, showingAllTrees };
}
