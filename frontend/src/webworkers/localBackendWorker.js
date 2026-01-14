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

// ─────────────────────────────────────────────────────────────────
// Tree Data Cache: Stores parsed tree data from backend PyArrow
// Key: global_index (tree index)
// Value: { node_id, parent_id, is_tip, x, y, nodeCount }
// ─────────────────────────────────────────────────────────────────
const treeDataCache = new Map();
const treeDataCacheAccess = new Map();
const MAX_TREE_DATA_CACHE_BYTES = 100 * 1024 * 1024; // 100MB
let treeDataCacheBytes = 0;

/**
 * Estimate memory size of cached tree data
 */
function estimateTreeDataSize(treeData) {
  if (!treeData) return 0;
  const nodeCount = treeData.nodeCount || 0;
  // Each node: node_id(4) + parent_id(4) + is_tip(1) + x(4) + y(4) = ~17 bytes
  // Plus typed array overhead
  return nodeCount * 20;
}

/**
 * Evict tree data until cache is under target bytes using LRU
 */
function evictTreeDataUntilUnder(targetBytes) {
  if (treeDataCacheBytes <= targetBytes) return;

  const entries = [...treeDataCache.entries()].sort((a, b) => {
    return (treeDataCacheAccess.get(a[0]) || 0) - (treeDataCacheAccess.get(b[0]) || 0);
  });

  for (const [key, data] of entries) {
    if (treeDataCacheBytes <= targetBytes) break;
    const size = estimateTreeDataSize(data);
    treeDataCache.delete(key);
    treeDataCacheAccess.delete(key);
    treeDataCacheBytes -= size;
    console.log(`[TreeCache] Evicted tree ${key}, freed ${size} bytes`);
  }
}

/**
 * Store tree data in cache with memory tracking
 */
function cacheTreeData(global_index, data) {
  const size = estimateTreeDataSize(data);

  // Evict if adding would exceed limit
  if (treeDataCacheBytes + size > MAX_TREE_DATA_CACHE_BYTES) {
    evictTreeDataUntilUnder(MAX_TREE_DATA_CACHE_BYTES - size);
  }

  // Remove old entry if exists
  if (treeDataCache.has(global_index)) {
    const oldSize = estimateTreeDataSize(treeDataCache.get(global_index));
    treeDataCacheBytes -= oldSize;
  }

  treeDataCache.set(global_index, data);
  treeDataCacheAccess.set(global_index, Date.now());
  treeDataCacheBytes += size;
}

/**
 * Get tree data from cache, updating access time
 */
function getCachedTreeData(global_index) {
  const data = treeDataCache.get(global_index);
  if (data) {
    treeDataCacheAccess.set(global_index, Date.now());
  }
  return data;
}

/**
 * Check if tree data is cached
 */
function hasTreeDataCached(global_index) {
  return treeDataCache.has(global_index);
}

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

  // ─────────────────────────────────────────────────────────────────
  // Filter displayArray by tree data cache
  // Only fetch trees that are NOT already cached
  // ─────────────────────────────────────────────────────────────────
  const uncachedDisplayArray = displayArray.filter(idx => !hasTreeDataCached(idx));
  const cachedCount = displayArray.length - uncachedDisplayArray.length;

  if (displayArray.length > 0) {
    console.log(`[TreeCache] Cache hit: ${cachedCount}/${displayArray.length} trees, fetching ${uncachedDisplayArray.length} from backend`);
  }

  return {
    local_bins: return_local_bins,
    lower_bound,
    upper_bound,
    displayArray: uncachedDisplayArray,  // Only trees needing backend fetch
    allDisplayIndices: displayArray,      // Full list for rendering (cached + uncached)
    showing_all_trees: showingAllTrees
  };
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
    // Compute render data from PyArrow buffer + cached tree data
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
          tree_indices,
          allDisplayIndices  // Full list of trees to render (cached + uncached)
        } = data;

        // Reconstruct bins Map from serialized format
        const binsMap = new Map();
        if (bins && typeof bins === 'object') {
          if (Array.isArray(bins)) {
            for (const [key, value] of bins) {
              binsMap.set(key, value);
            }
          } else {
            for (const [key, value] of Object.entries(bins)) {
              binsMap.set(Number(key), value);
            }
          }
        }

        // Parse PyArrow buffer if present (may be empty if all trees cached)
        let newNode_id, newParent_id, newIs_tip, newTree_idx, newX, newY;
        if (buffer && buffer.byteLength > 0) {
          const uint8 = new Uint8Array(buffer);
          const table = arrow.tableFromIPC(uint8);

          newNode_id = table.getChild('node_id')?.toArray();
          newParent_id = table.getChild('parent_id')?.toArray();
          newIs_tip = table.getChild('is_tip')?.toArray();
          newTree_idx = table.getChild('tree_idx')?.toArray();
          newX = table.getChild('x')?.toArray();
          newY = table.getChild('y')?.toArray();

          // ─────────────────────────────────────────────────────────────────
          // Cache newly fetched tree data (grouped by tree_idx)
          // ─────────────────────────────────────────────────────────────────
          if (newTree_idx && newNode_id && newTree_idx.length > 0) {
            // Group nodes by tree_idx
            const treeGroups = new Map();
            for (let i = 0; i < newTree_idx.length; i++) {
              const treeIdx = newTree_idx[i];
              if (!treeGroups.has(treeIdx)) {
                treeGroups.set(treeIdx, []);
              }
              treeGroups.get(treeIdx).push(i);
            }

            // Cache each tree's data
            for (const [treeIdx, indices] of treeGroups) {
              const nodeCount = indices.length;
              const cachedData = {
                node_id: new Int32Array(nodeCount),
                parent_id: new Int32Array(nodeCount),
                is_tip: new Uint8Array(nodeCount),
                x: new Float32Array(nodeCount),
                y: new Float32Array(nodeCount),
                nodeCount
              };

              for (let j = 0; j < nodeCount; j++) {
                const srcIdx = indices[j];
                cachedData.node_id[j] = newNode_id[srcIdx];
                cachedData.parent_id[j] = newParent_id[srcIdx];
                cachedData.is_tip[j] = newIs_tip[srcIdx] ? 1 : 0;
                cachedData.x[j] = newX[srcIdx];
                cachedData.y[j] = newY[srcIdx];
              }

              cacheTreeData(treeIdx, cachedData);
              console.log(`[TreeCache] Cached tree ${treeIdx} with ${nodeCount} nodes`);
            }
            console.log(`[TreeCache] Cache now has ${treeDataCache.size} trees: [${[...treeDataCache.keys()].join(', ')}]`);
          }
        }

        // ─────────────────────────────────────────────────────────────────
        // Extract modelMatrices from bins for visible trees only
        // ─────────────────────────────────────────────────────────────────
        const modelMatrices = new Map();
        for (const [key, bin] of binsMap) {
          if (bin.visible && bin.modelMatrix) {
            modelMatrices.set(bin.global_index, bin.modelMatrix);
          }
        }

        const renderIndices = allDisplayIndices || tree_indices || [];

        console.log(`[TreeCache] Render indices: ${renderIndices.length}, cache size: ${treeDataCache.size}, visible bins: ${modelMatrices.size}`);

        // ─────────────────────────────────────────────────────────────────
        // Combine cached data for trees that have BOTH cache AND modelMatrix
        // ─────────────────────────────────────────────────────────────────
        let totalNodes = 0;
        const treesToRender = [];

        for (const treeIdx of renderIndices) {
          const cached = getCachedTreeData(treeIdx);
          const hasMatrix = modelMatrices.has(treeIdx);
          if (cached && hasMatrix) {
            totalNodes += cached.nodeCount;
            treesToRender.push(treeIdx);
          } else if (!cached) {
            console.warn(`[TreeCache] Missing cache for tree ${treeIdx}`);
          } else if (!hasMatrix) {
            console.warn(`[TreeCache] Missing modelMatrix for tree ${treeIdx}`);
          }
        }

        console.log(`[TreeCache] Trees to render: ${treesToRender.length}, total nodes: ${totalNodes}`);

        // Allocate combined arrays
        const combined_node_id = new Int32Array(totalNodes);
        const combined_parent_id = new Int32Array(totalNodes);
        const combined_is_tip = new Uint8Array(totalNodes);
        const combined_tree_idx = new Int32Array(totalNodes);
        const combined_x = new Float32Array(totalNodes);
        const combined_y = new Float32Array(totalNodes);

        // Copy data from cache for trees that will be rendered
        let offset = 0;
        for (const treeIdx of treesToRender) {
          const cached = getCachedTreeData(treeIdx);
          if (cached) {
            const n = cached.nodeCount;
            combined_node_id.set(cached.node_id, offset);
            combined_parent_id.set(cached.parent_id, offset);
            combined_is_tip.set(cached.is_tip, offset);
            combined_x.set(cached.x, offset);
            combined_y.set(cached.y, offset);
            // Fill tree_idx for this range
            for (let i = 0; i < n; i++) {
              combined_tree_idx[offset + i] = treeIdx;
            }
            offset += n;
          }
        }

        console.log(`[TreeCache] Combined arrays - node_id: ${combined_node_id.length}, modelMatrices: ${modelMatrices.size}`);

        // Compute render arrays using combined data and modelMatrices
        const result = computeRenderArrays({
          node_id: combined_node_id,
          parent_id: combined_parent_id,
          is_tip: combined_is_tip,
          tree_idx: combined_tree_idx,
          x: combined_x,
          y: combined_y,
          modelMatrices,  // Pass modelMatrices instead of bins
          metadataArrays,
          metadataColors,
          populationFilter
        });

        console.log(`[TreeCache] Render result - paths: ${result.pathPositions?.length || 0}, tips: ${result.tipPositions?.length || 0}`);

        // Add metadata to result
        result.global_min_time = global_min_time;
        result.global_max_time = global_max_time;
        result.tree_indices = renderIndices;

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
    // Clear buffers to free memory
    // ─────────────────────────────────────────────────────────────────
    if (data.type === "clear-buffers") {
      clearRenderBuffers();
      // Clear tree caches
      pathsData.clear();
      pathsDataAccess.clear();
      currentCacheBytes = 0;
      // Clear tree data cache
      treeDataCache.clear();
      treeDataCacheAccess.clear();
      treeDataCacheBytes = 0;
      console.log("[TreeCache] All caches cleared");
      postMessage({ type: "buffers-cleared" });
    }
  }
}
