import { Matrix4 } from "@math.gl/core";
import * as arrow from "apache-arrow";
import { computeLineageSegments } from "./modules/lineageUtils.js";
import {
  extractSquarePaths,
  globalCleanup,
  dedupeSegments
} from "./modules/treeProcessing.js";
import {
  computeRenderArrays,
  clearBuffers as clearRenderBuffers
} from "./modules/renderDataComputation.js";

import {
  nearestIndex,
  upperBound,
  findClosestBinIndices,
  new_complete_experiment_map
} from "./modules/binningUtils.js";

console.log("[Worker] Initialized with PyArrow support");

postMessage({ data: "Worker starting" });

const sendStatusMessage = (status_obj) => {
  postMessage({
    type: "status",
    data: status_obj,
  });
};

// Global State
let globalBins = [];
let tsconfig = null;
let lastStart = null;
let lastEnd = null;
let globalLocalBins = new Map();
const pathsData = new Map();

// Maximum number of trees to keep in cache to prevent memory bloat
const MAX_CACHED_TREES = 30;

// Memory-based cache limit (50MB)
const MAX_CACHE_BYTES = 50 * 1024 * 1024;
let currentCacheBytes = 0;

// Track last access time for LRU eviction
const pathsDataAccess = new Map();

/**
 * Estimate memory size of a tree object
 */
function estimateTreeSize(tree) {
  if (!tree) return 0;
  // Rough estimate: nodes * 100 bytes per node (accounting for object overhead)
  const nodeCount = tree.node?.length || 0;
  return nodeCount * 100;
}

/**
 * Evict trees until cache is under target bytes using LRU
 */
function evictUntilUnder(targetBytes) {
  if (currentCacheBytes <= targetBytes) return;

  // Sort entries by last access time (oldest first)
  const entries = [...pathsData.entries()].sort((a, b) => {
    return (pathsDataAccess.get(a[0]) || 0) - (pathsDataAccess.get(b[0]) || 0);
  });

  for (const [key, tree] of entries) {
    if (currentCacheBytes <= targetBytes) break;
    const size = estimateTreeSize(tree);
    pathsData.delete(key);
    pathsDataAccess.delete(key);
    currentCacheBytes -= size;
    console.log(`[Cache] Evicted tree ${key}, freed ${size} bytes, cache now ${currentCacheBytes} bytes`);
  }
}

/**
 * Add tree to cache with memory tracking
 */
function cacheTree(key, tree) {
  const size = estimateTreeSize(tree);

  // Evict if adding would exceed limit
  if (currentCacheBytes + size > MAX_CACHE_BYTES) {
    evictUntilUnder(MAX_CACHE_BYTES - size);
  }

  // Remove old entry if exists
  if (pathsData.has(key)) {
    const oldSize = estimateTreeSize(pathsData.get(key));
    currentCacheBytes -= oldSize;
  }

  pathsData.set(key, tree);
  pathsDataAccess.set(key, Date.now());
  currentCacheBytes += size;
}

/**
 * Get tree from cache, updating access time
 */
function getCachedTree(key) {
  const tree = pathsData.get(key);
  if (tree) {
    pathsDataAccess.set(key, Date.now());
  }
  return tree;
}

// Helper to delete from pathsData for trees outside current range
function deleteRangeByValue(min, max) {
  for (const key of pathsData.keys()) {
    if (key < min || key > max) {
      const size = estimateTreeSize(pathsData.get(key));
      pathsData.delete(key);
      pathsDataAccess.delete(key);
      currentCacheBytes -= size;
    }
  }
}

// Aggressive cleanup when cache gets too large
function enforcePathsCacheLimit(invisibleKeys = new Set()) {
  // First try count-based limit
  if (pathsData.size > MAX_CACHED_TREES) {
    invisibleKeys.forEach(key => {
      if (pathsData.has(key)) {
        const size = estimateTreeSize(pathsData.get(key));
        pathsData.delete(key);
        pathsDataAccess.delete(key);
        currentCacheBytes -= size;
      }
    });
  }

  // Then enforce memory limit
  if (currentCacheBytes > MAX_CACHE_BYTES) {
    evictUntilUnder(MAX_CACHE_BYTES * 0.8); // Free 20% extra headroom
  }
}

/**
 * Get local tree data for a genomic region with configurable display options
 * 
 * @param {number} start - Start genomic position (bp)
 * @param {number} end - End genomic position (bp)
 * @param {number} globalBpPerUnit - Base pairs per unit (for coordinate conversion)
 * @param {number} nTrees - Number of trees (unused, kept for compatibility)
 * @param {number} new_globalBp - Zoom-adjusted bp per unit
 * @param {number|null} regionWidth - Optional region width override
 * @param {Object} displayOptions - Display configuration options
 * @param {string} displayOptions.selectionStrategy - Strategy: 'largestSpan', 'centerWeighted', 'spanWeightedRandom', 'first'
 * @returns {Object} { local_bins, lower_bound, upper_bound, displayArray }
 */
async function getLocalData(start, end, globalBpPerUnit, nTrees, new_globalBp, regionWidth = null, displayOptions = {}) {
  // Default display options
  const {
    selectionStrategy = 'largestSpan',
  } = displayOptions;

  let scaleFactor = new_globalBp / globalBpPerUnit;

  // Lower precision range for better sparsification (will be overridden by binning logic)
  const computedPrecision = Math.max(1, Math.min(3, Math.floor(4 - Math.log10(scaleFactor || 1))));

  // Calculate buffer so that it increases with region size, decreases as region shrinks
  let local_regionWidth = regionWidth ?? Math.max(1, end - start); // avoid 0/neg

  let buffer = 0.1;
  if (scaleFactor > 1) {
    buffer = buffer * local_regionWidth;
  } else {
    buffer = local_regionWidth;
  }
  buffer = 0.0;
  const bufferStart = Math.max(0, start - buffer);
  const bufferEnd = end + (buffer);

  const lower_bound = nearestIndex(tsconfig.intervals, bufferStart);
  const upper_bound = upperBound(tsconfig.intervals, bufferEnd);
  deleteRangeByValue(lower_bound, upper_bound);

  const local_bins = new Map();

  // ────────────────────────────────
  // Utility to quickly add bins
  // ────────────────────────────────
  const addBins = (lo, hi) => {
    for (let i = lo; i <= hi; i++) {
      const temp_bin = tsconfig.intervals[i];
      const next_bin_start = tsconfig.intervals[i + 1] ? tsconfig.intervals[i + 1] : tsconfig.genome_length;
      if (!temp_bin) continue;
      local_bins.set(i, {
        s: temp_bin,
        e: next_bin_start,
        path: null,
        global_index: i,
        precision: computedPrecision
      });
    }
  };

  // ────────────────────────────────
  // Region management (no per-key delete)
  // ────────────────────────────────
  if (
    lastStart == null ||
    lastEnd == null ||
    upper_bound < lastStart ||
    lower_bound > lastEnd
  ) {
    // Non-overlapping → rebuild completely
    addBins(lower_bound, upper_bound);
  } else {
    // Overlapping → reuse bins where possible
    for (let i = lower_bound; i <= upper_bound; i++) {
      if (!globalLocalBins.has(i)) {
        const temp_bin = tsconfig.intervals[i];
        const next_bin_start = tsconfig.intervals[i + 1] ? tsconfig.intervals[i + 1] : tsconfig.genome_length;
        if (temp_bin != null) {
          local_bins.set(i, {
            s: temp_bin,
            e: next_bin_start,
            path: null,
            global_index: i,
            precision: computedPrecision
          });
        }
      } else {
        local_bins.set(i, globalLocalBins.get(i));
      }
    }
  }

  // Pass display options to the binning function
  const { return_local_bins, displayArray, invisibleKeys, showingAllTrees } = new_complete_experiment_map(
    local_bins,
    globalBpPerUnit,
    new_globalBp,
    {
      selectionStrategy,
      viewportStart: start,
      viewportEnd: end
    },
  );

  lastStart = lower_bound;
  lastEnd = upper_bound;
  globalLocalBins = return_local_bins;

  // Cleanup pathsData for trees no longer in view (with buffer)
  deleteRangeByValue(lower_bound, upper_bound);

  enforcePathsCacheLimit(invisibleKeys);

  return { local_bins: return_local_bins, lower_bound, upper_bound, displayArray, showing_all_trees: showingAllTrees };
}

export const queryConfig = async (data) => {
  try {
    tsconfig = data.data;


    // intervalKeys = Object.keys(tsconfig.new_intervals).map(Number)

    // intervalKeys = tsconfig.intervals.map(interval => interval[);
    // intervalKeys = tsconfig.intervals;

    return;
  } catch (error) {
    console.log("error", error);
  }
}

export const queryValueChanged = async (value) => {
  const [x0, x1] = value;
  const { i0, i1 } = findClosestBinIndices(globalBins, x0, x1);
  return { i0, i1 };
}

/**
 * Get processed tree data with adaptive sparsification.
 * 
 * @param {number} global_index - Global tree index
 * @param {Object} options - Sparsification options
 * @param {number} options.precision - Precision parameter for coordinate quantization
 * @param {boolean} options.showingAllTrees - Whether all trees are being shown (skip sparsification)
 * @returns {Array|null} Array of segments or null if tree not found
 */
export function getTreeData(global_index, options = {}) {
  // Support legacy call signature: getTreeData(global_index, precision)
  if (typeof options === 'number') {
    options = { precision: options };
  }

  const {
    precision = 9,
    showingAllTrees = false
  } = options;

  if (pathsData.has(global_index)) {
    const processedTree = pathsData.get(global_index);
    const segments = [];
    if (processedTree.roots) {
      processedTree.roots.forEach(root => {
        extractSquarePaths(root, segments);
      });
    } else if (processedTree.root) {
      extractSquarePaths(processedTree.root, segments);
    }
    const dedupedSegments = dedupeSegments(segments, {
      precision,
      showingAllTrees
    });
    return dedupedSegments;
  }
  return null;
}


// Helper: Find highlights and lineage seeds in a single pass
function findHighlights(tree, uniqueTerms, collectSeeds = true, sampleColors = {}) {
  const highlights = [];
  const seeds = new Set();
  const seedColors = new Map();

  if (tree.node && Array.isArray(tree.node)) {
    for (let i = 0; i < tree.node.length; i++) {
      const node = tree.node[i];
      if (node.is_tip && node.name && uniqueTerms.has(node.name.toLowerCase())) {
        // Add to highlights
        highlights.push({
          position: [node.y, node.x ?? node.x_dist],
          name: node.name
        });

        // Add to seeds (if needed)
        if (collectSeeds) {
          seeds.add(node);
          const color = sampleColors[node.name.toLowerCase()];
          if (color) {
            seedColors.set(node.node_id, color);
          }
        }
      }
    }
  }
  return { highlights, seeds, seedColors };
}



onmessage = async (event) => {
  //Process uploaded data:
  const { data } = event;
  // console.log("Worker onmessage", data.type);

  if (data.type === "upload") {
    console.log("upload value: TO IMPLEMENT")

  } else {

    if (data.type === "gettree") {
      const result = await getTreeData(data.global_index, {
        precision: data.precision,
        showingAllTrees: data.showingAllTrees ?? false
      });
      postMessage({ type: "gettree", data: result });
    }

    if (data.type === "search") {
      const { term, terms, id, options } = data;
      const { showLineages = true, sampleColors = {} } = options || {};
      const lineageResults = {}; // global_index -> segments
      const highlightResults = {}; // global_index -> points

      const activeTerms = [];
      if (terms && Array.isArray(terms)) {
        activeTerms.push(...terms);
      }
      if (term) {
        activeTerms.push(term);
      }
      // Deduplicate and filter empty
      const uniqueTerms = new Set([...activeTerms.map(t => t.trim().toLowerCase()).filter(t => t !== "")]);

      if (uniqueTerms.size > 0) {
        for (const [global_index, tree] of pathsData.entries()) {
          // 1. Find matches
          const { highlights, seeds, seedColors } = findHighlights(tree, uniqueTerms, showLineages, sampleColors);

          if (highlights.length > 0) {
            highlightResults[global_index] = highlights;
          }

          // 2. Compute Lineages
          if (seeds.size > 0 && showLineages) {
            const segments = computeLineageSegments(tree, seeds, seedColors);
            lineageResults[global_index] = segments
            // const deduped = dedupeSegments(segments);
            // if (deduped.length > 0) {
            //   lineageResults[global_index] = deduped;
            // }
          }
        }
      }
      postMessage({ type: "search-result", data: { lineage: lineageResults, highlights: highlightResults }, id });
    }
    if (data.type === "config") {
      const result = await queryConfig(data);
      // console.log("config result", result);
      postMessage({ type: "config", data: result });
    }

    if (data.type === "local-bins") {
      // Extract display options from the message data (fallback to defaults inside getLocalData)
      const displayOptions = data.data.displayOptions || {};

      let result = await getLocalData(
        data.data.start,
        data.data.end,
        data.data.globalBpPerUnit,
        data.data.nTrees,
        data.data.new_globalBp,
        data.data.regionWidth,
        displayOptions
      );
      postMessage({ type: "local-bins", data: result });
    }

    if (data.type === "value-changed") {
      const result = await queryValueChanged(data.data);
      postMessage({ type: "value-changed", data: result });
    }

    if (data.type === "details") {
      console.log("data details value: TO IMPLEMENT")
    }

    // ─────────────────────────────────────────────────────────────────
    // NEW: Compute render data from PyArrow buffer (off main thread)
    // ─────────────────────────────────────────────────────────────────
    if (data.type === "compute-render-data") {
      try {
        const {
          buffer,
          bins,
          metadataArrays,
          metadataColors,
          populationFilter,
          global_min_time,
          global_max_time,
          tree_indices
        } = data;

        // Parse PyArrow buffer in worker (off main thread)
        const uint8 = new Uint8Array(buffer);
        const table = arrow.tableFromIPC(uint8);

        // Extract columns as typed arrays (no Array.from - keeps as typed arrays)
        const node_id = table.getChild('node_id')?.toArray();
        const parent_id = table.getChild('parent_id')?.toArray();
        const is_tip = table.getChild('is_tip')?.toArray();
        const tree_idx = table.getChild('tree_idx')?.toArray();
        const x = table.getChild('x')?.toArray();
        const y = table.getChild('y')?.toArray();

        // Reconstruct bins Map from serialized format
        const binsMap = new Map();
        if (bins && typeof bins === 'object') {
          // If bins is an array of [key, value] pairs
          if (Array.isArray(bins)) {
            for (const [key, value] of bins) {
              binsMap.set(key, value);
            }
          } else {
            // If bins is a plain object
            for (const [key, value] of Object.entries(bins)) {
              binsMap.set(Number(key), value);
            }
          }
        }

        // Compute render arrays in worker
        const result = computeRenderArrays({
          node_id,
          parent_id,
          is_tip,
          tree_idx,
          x,
          y,
          bins: binsMap,
          metadataArrays,
          metadataColors,
          populationFilter
        });

        // Add metadata to result
        result.global_min_time = global_min_time;
        result.global_max_time = global_max_time;
        result.tree_indices = tree_indices;

        // Transfer typed array buffers back (zero-copy)
        const transferables = [];
        if (result.pathPositions?.buffer) transferables.push(result.pathPositions.buffer);
        if (result.tipPositions?.buffer) transferables.push(result.tipPositions.buffer);
        if (result.tipColors?.buffer) transferables.push(result.tipColors.buffer);

        postMessage({ type: "render-data", data: result }, transferables);

      } catch (error) {
        console.error("[Worker] Error computing render data:", error);
        postMessage({
          type: "render-data",
          error: error.message,
          data: {
            pathPositions: new Float32Array(0),
            tipPositions: new Float32Array(0),
            tipColors: new Uint8Array(0),
            tipData: [],
            edgeCount: 0,
            tipCount: 0
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // NEW: Clear buffers to free memory
    // ─────────────────────────────────────────────────────────────────
    if (data.type === "clear-buffers") {
      clearRenderBuffers();
      // Also clear tree cache
      pathsData.clear();
      pathsDataAccess.clear();
      currentCacheBytes = 0;
      postMessage({ type: "buffers-cleared" });
    }
  }
}
