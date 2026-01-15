import { Matrix4 } from "@math.gl/core";
// preallocate a reusable Matrix4 to avoid GC churn
const tempMatrix = new Matrix4();

// Extract the sorted x-array once
export function getXArray(globalBins) {
  return globalBins.map(b => b.acc);
}

export function distribute(total, spans, alpha = 0.5) {
  const n = spans.length;
  const spacing = 0.0;
  const S = spans.reduce((a, b) => a + b, 0);
  return spans.map(s => total * (alpha * (1 / n) + (1 - alpha) * (s / S)) - spacing);
}

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

// Main helper: returns the two indices (i0 for x0, i1 for x1)
export function findClosestBinIndices(globalBins, x0, x1) {
  const xs = getXArray(globalBins);
  const i0 = nearestIndex(xs, x0);
  const i1 = nearestIndex(xs, x1);
  return { i0, i1 };
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
   * @param {Array} trees - Array of tree objects with { idx, span, midpoint }
   * @returns {Object} Selected tree
   */
  largestSpan: (trees) => {
    if (trees.length === 0) return null;
    return trees.reduce((max, t) => (t.span > max.span ? t : max), trees[0]);
  },

  /**
   * Select the tree closest to the slot's center genomic position
   * @param {Array} trees - Array of tree objects with { idx, span, midpoint }
   * @param {number} slotMidpoint - The genomic midpoint of the slot
   * @returns {Object} Selected tree
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
   * @param {Array} trees - Array of tree objects with { idx, span, midpoint }
   * @returns {Object} Selected tree
   */
  spanWeightedRandom: (trees) => {
    return weightedRandomSelect(trees, t => t.span);
  },

  /**
   * Select the first tree (by genomic position)
   * @param {Array} trees - Array of tree objects with { idx, span, midpoint }
   * @returns {Object} Selected tree
   */
  first: (trees) => {
    if (trees.length === 0) return null;
    return trees.reduce((first, t) => (t.s < first.s ? t : first), trees[0]);
  }
};

/**
 * Get selection strategy function by name
 * @param {string} strategyName - Name of the strategy
 * @returns {Function} Strategy function
 */
export function getSelectionStrategy(strategyName) {
  return selectionStrategies[strategyName] || selectionStrategies.largestSpan;
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
 * @returns {Object} { return_local_bins, displayArray }
 */
export function new_complete_experiment_map( localBins, globalBpPerUnit, new_globalBp, options = {}) {
  const {
    selectionStrategy = 'largestSpan',
    viewportStart = null,
    viewportEnd = null
  } = options;

  const invisibleKeys = new Set()
  const spacing = 1.05;
  const displayArray = [];

  const scaleFactor = new_globalBp / globalBpPerUnit;
  const approxEqual = scaleFactor < 1;

  // TODO: later to provide user control over the selection strategy
  const selectFn = getSelectionStrategy(selectionStrategy);

  // ────────────────────────────────────────────────────────────────────────
  // STEP 1: Collect all trees and compute their properties
  // ────────────────────────────────────────────────────────────────────────
  const allTrees = [];
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const [key, bin] of localBins.entries()) {
    const { s, e } = bin;
    const span = e - s;
    const midpoint = (s + e) / 2;
    
    allTrees.push({
      idx: Number(key),
      s,
      e,
      span,
      midpoint,
      bin
    });
    
    minStart = Math.min(minStart, s);
    maxEnd = Math.max(maxEnd, e);
  }

  if (allTrees.length === 0) {
    return { return_local_bins: localBins, displayArray };
  }

  // Sort trees by genomic position
  allTrees.sort((a, b) => a.s - b.s);

  const viewportSpan = maxEnd - minStart;

  // ────────────────────────────────────────────────────────────────────────
  // STEP 2: Calculate fixed visual width and slot count
  // ────────────────────────────────────────────────────────────────────────
  
  // Calculate how many slots we need based on zoom level
  // At scale factor 1 (fully zoomed in), show all trees
  // As scale factor increases, reduce number of visible slots
  const maxVisibleTrees = 10; // maximum number of trees to show at full zoom
  const effectiveMaxTrees = approxEqual 
    ? allTrees.length 
    : Math.max(1, Math.max(maxVisibleTrees, Math.ceil(allTrees.length / scaleFactor)));
  
  const numSlots = Math.min(allTrees.length, effectiveMaxTrees);
  const slotWidth = viewportSpan / numSlots; // genomic width per slot

  const showingAllTrees = approxEqual;
  // ────────────────────────────────────────────────────────────────────────
  // STEP 3: When scaleFactor ≈ 1, show ALL trees with uniform width
  // ────────────────────────────────────────────────────────────────────────
  if (approxEqual) {
    // Calculate tree width based on actual visible viewport (not tree bounds)
    // This ensures all trees fit on screen regardless of their genomic distribution
    const fullZoomGapFill = 0.9; // widen to fit but keep a small gap
    
    // Use viewport bounds if provided, otherwise fall back to tree bounds
    const effectiveStart = viewportStart ?? minStart;
    const effectiveEnd = viewportEnd ?? maxEnd;
    const visibleUnits = (effectiveEnd - effectiveStart) / globalBpPerUnit;
    const uniformTreeWidth = (visibleUnits / allTrees.length) * fullZoomGapFill;
    
    // Recalculate slot width based on effective viewport
    const slotWidth = (effectiveEnd - effectiveStart) / allTrees.length;

    for (let i = 0; i < allTrees.length; i++) {
      const tree = allTrees[i];
      const slotCenter = effectiveStart + (i + 0.5) * slotWidth;
      const translateX = (slotCenter / globalBpPerUnit) - (uniformTreeWidth / 2);
      
      const modelMatrix = tempMatrix.clone()
        .translate([translateX, 0, 0])
        .scale([uniformTreeWidth, 1, 1]);
      localBins.set(tree.idx, {
        ...tree.bin,
        modelMatrix,
        visible: true,
        position: tree.s,
        span: tree.span,
        precision: 2, // Maximum precision at full zoom (lowered for better sparsification)
        slotIndex: i,
        isRepresentative: true,
        groupSize: 1
      });

      displayArray.push(tree.idx);
    }

    return { return_local_bins: localBins, displayArray, showingAllTrees };
  }

  // ────────────────────────────────────────────────────────────────────────
  // STEP 3b: Assign trees to slots based on their midpoint (zoomed out)
  // ────────────────────────────────────────────────────────────────────────
  const slots = new Map(); // slotIndex -> array of trees

  for (const tree of allTrees) {
    const slotIndex = Math.min(
      numSlots - 1,
      Math.max(0, Math.floor((tree.midpoint - minStart) / slotWidth))
    );
    
    if (!slots.has(slotIndex)) {
      slots.set(slotIndex, []);
    }
    slots.get(slotIndex).push(tree);
  }

  // ────────────────────────────────────────────────────────────────────────
  // STEP 4: Select representative tree for each slot and compute transforms
  // ────────────────────────────────────────────────────────────────────────
  const selectedTrees = new Set();
  
  // Calculate visual width per slot to prevent overlap
  // Each slot gets an equal portion of the viewport, with spacing between trees
  const slotVisualWidth = slotWidth / globalBpPerUnit;
  const treeVisualWidth = slotVisualWidth / spacing; // Leave gap between trees

  for (const [slotIndex, treesInSlot] of slots.entries()) {
    // Calculate slot boundaries in genomic coordinates
    const slotStart = minStart + slotIndex * slotWidth;
    const slotMidpoint = slotStart + slotWidth / 2;

    // Select representative tree using configured strategy
    let selectedTree;
    if (selectionStrategy === 'centerWeighted') {
      selectedTree = selectFn(treesInSlot, slotMidpoint);
    } else {
      selectedTree = selectFn(treesInSlot);
    }

    if (selectedTree) {
      selectedTrees.add(selectedTree.idx);
      
      // Compute precision based on how many trees are grouped
      const precision = computePrecisionFromGroupSize(treesInSlot.length, scaleFactor);
      
      // Position tree at the CENTER of its slot to avoid overlap
      // Convert slot center to world coordinates
      const slotCenterWorld = slotMidpoint / globalBpPerUnit;
      const translateX = slotCenterWorld - treeVisualWidth / 2;
      
      const modelMatrix = tempMatrix.clone()
        .translate([translateX, 0, 0])
        .scale([treeVisualWidth, 1, 1]);

      localBins.set(selectedTree.idx, {
        ...selectedTree.bin,
        modelMatrix,
        visible: true,
        position: selectedTree.s,
        span: selectedTree.span,
        precision,
        slotIndex,
        isRepresentative: true,
        groupSize: treesInSlot.length
      });

      displayArray.push(selectedTree.idx);
    }

    // Mark non-selected trees as invisible
    for (const tree of treesInSlot) {
      if (!selectedTrees.has(tree.idx)) {
        invisibleKeys.add(tree.idx);
        localBins.set(tree.idx, {
          ...tree.bin,
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

/**
 * Compute precision level based on group size and scale factor
 * Higher precision (more detail) when fewer trees are grouped
 * @param {number} groupSize - Number of trees in the group
 * @param {number} scaleFactor - Current zoom scale factor
 * @returns {number} Precision level (1-3)
 */
function computePrecisionFromGroupSize(groupSize, scaleFactor) {
  if (groupSize === 1 && scaleFactor <= 1) {
    return 3; // Maximum precision for single trees at full zoom (lowered for sparsification)
  }
  
  // Reduce precision as group size increases
  const logGroup = Math.log10(Math.max(1, groupSize));
  const logScale = Math.log10(Math.max(1, scaleFactor));
  
  // Map to precision range [1, 3] - lower values = more aggressive sparsification
  // With 6 trees visible, logGroup ≈ 0.78, so precision ≈ 3 - 0.78 - logScale/2 ≈ 2-3
  const precision = Math.max(1, Math.min(3, 3 - Math.floor(logGroup + logScale / 2)));
  return precision;
}
