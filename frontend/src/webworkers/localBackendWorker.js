import { Matrix4 } from "@math.gl/core";
import { computeLineageSegments } from "./modules/lineageUtils.js";
import {
  extractSquarePaths,
  processNewick,
  globalCleanup,
  dedupeSegments
} from "./modules/treeProcessing.js";
import {
  nearestIndex,
  upperBound,
  findClosestBinIndices,
  new_complete_experiment_map
} from "./modules/binningUtils.js";

console.log("[Worker] Initialized");

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

// Helper to delete from pathsData for trees outside current range
function deleteRangeByValue(min, max) {
  // const keysToDelete = [];
  for (const key of pathsData.keys()) {
    if (key < min || key > max) {
      // keysToDelete.push(key);
      pathsData.delete(key);
    }
  }
}

// Aggressive cleanup when cache gets too large
function enforcePathsCacheLimit(invisibleKeys=new Set()) {
  if (pathsData.size > MAX_CACHED_TREES) {
    invisibleKeys.forEach(key => {
      pathsData.delete(key);
    });

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

  const computedPrecision = Math.max(2, Math.min(9, Math.floor(8 - Math.log10(scaleFactor || 1))));

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

export const queryNodes = async (localTrees) => {
  try {
    // const received_data = JSON.parse(data);

    // const localTrees = received_data.tree_dict;
    const processed_data = await processData(localTrees, sendStatusMessage)
    const result = {
      paths: processed_data,
      // genome_positions: received_data.genome_positions,
      // tree_index: tree_index,
      // times: times
    }


    return result;
  } catch (error) {
    console.log("error", error)
    // console.error("Error in queryNodes: ", error);
  }
};

export function getTreeData(global_index, precision) {
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
    const dedupedSegments = dedupeSegments(segments, precision);
    return dedupedSegments;
  }
  return null;
}

function processData(localTrees, sendStatusMessage) {
  if (Array.isArray(localTrees)) {
    for (let i = 0; i < localTrees.length; i++) {
      const tree = localTrees[i];

      const processedTree = processNewick(
        tree.newick,
        tree.mutations,
        -1 * tsconfig.times.values[1],
        tsconfig.times.values[0],
        tree.time_range,
      );

      pathsData.set(tree.global_index, processedTree);
    }
    
    // Enforce cache limit to prevent memory bloat
    // enforcePathsCacheLimit();
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
      const result = await getTreeData(data.global_index, data.precision);
      postMessage({ type: "gettree", data: result });
    }
    if (data.type === "query") {
      const result = await queryNodes(data.data.tree_dict);
      postMessage({ type: "query", data: result });
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
      // Extract display options from the message data
      const displayOptions = {
        selectionStrategy: 'largestSpan'
      };
      
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
  }
}