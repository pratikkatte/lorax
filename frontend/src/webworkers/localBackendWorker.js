import { Matrix4 } from "@math.gl/core";
import { findLineage, extractLineagePaths } from "./modules/lineageUtils.js";
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
// let intervalKeys = [];
let globalLocalBins = new Map();
const pathsData = new Map();

// Helper to delete from pathsData
function deleteRangeByValue(min, max) {
  for (const [key, value] of pathsData.entries()) {
    if (key < min || key > max) {
      pathsData.delete(key);
    }
  }
}

async function getLocalData(start, end, globalBpPerUnit, nTrees, new_globalBp, regionWidth=null) {
  // if (!(localBins instanceof Map)) localBins = new Map();

      let scaleFactor = new_globalBp / globalBpPerUnit
  
  const computedPrecision = Math.max(2, Math.min(9, Math.floor(8 - Math.log10(scaleFactor || 1))));

  
  // Calculate buffer so that it increases with region size, decreases as region shrinks
  let local_regionWidth = regionWidth ?? Math.max(1, end - start); // avoid 0/neg
  
  let buffer = 0.1;
  if (scaleFactor > 1) {
    buffer = buffer * local_regionWidth;
  } else {
    buffer = local_regionWidth;
  }
  const bufferStart = Math.max(0, start - buffer);
  const bufferEnd = end + (buffer);

  // if (intervalKeys.length === 0) return { local_bins: new Map(), rangeArray: [] };

  // const lower_bound = lowerBound(intervalKeys, bufferStart);
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
      // const temp_bin = tsconfig.new_intervals[intervalKeys[i]];
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
        // const temp_bin = tsconfig.new_intervals[intervalKeys[i]];
        if (temp_bin != null) {
          local_bins.set(i, {
            s: temp_bin,
            e: next_bin_start,
            // e: temp_bin[1],
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
  const {return_local_bins, displayArray} = new_complete_experiment_map(local_bins,  globalBpPerUnit, new_globalBp);

  lastStart = lower_bound;
  lastEnd = upper_bound;
  globalLocalBins = return_local_bins;


  return { local_bins: return_local_bins, lower_bound, upper_bound, displayArray};
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

export const queryNodes = async (localTrees, vertical_mode) => {
  try {
    // const received_data = JSON.parse(data);

    // const localTrees = received_data.tree_dict;
    const processed_data = await processData(localTrees, sendStatusMessage, vertical_mode)
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
  if (pathsData.has(global_index)){
    const processedTree = pathsData.get(global_index);
    const segments = [];
    if (processedTree.roots) {
      processedTree.roots.forEach(root => {
        extractSquarePaths(root, false, segments);
      });
    } else if (processedTree.root) {
      extractSquarePaths(processedTree.root, false, segments);
    }
    const dedupedSegments = dedupeSegments(segments, precision);
    return dedupedSegments;
  }
  return null;
}

function processData(localTrees, sendStatusMessage, vertical_mode) {
  const paths = {};

  let prev_tree = null;
  if (Array.isArray(localTrees)) {
    localTrees.forEach((tree, index) => {

      const processedTree = processNewick(
        tree.newick,
        tree.mutations,
        -1*tsconfig.times.values[1],
        tsconfig.times.values[0],
        // tree.max_time,
        // tree.min_time,
        // tsconfig.times[0],
        // -1*tsconfig.times[1],
        tree.time_range,
        
        // tree.populations
      );

      pathsData.set(tree.global_index, processedTree);

    });
  }

  return null;
}

onmessage = async (event) => {
  //Process uploaded data:
  const { data } = event;
  // console.log("Worker onmessage", data.type);

  if (data.type === "upload")
  {
    console.log("upload value: TO IMPLEMENT")

  } else {

    if (data.type === "gettree") {
      const result = await getTreeData(data.global_index, data.precision);
      postMessage({ type: "gettree", data: result });
    }
    if (data.type === "query") {
      const result = await queryNodes(data.data.tree_dict, data.vertical_mode);
      postMessage({ type: "query", data: result });
    }
    if (data.type === "search") {
      const { term, terms, id } = data;
      const lineageResults = {}; // global_index -> segments
      
      const activeTerms = [];
      if (terms && Array.isArray(terms)) {
          activeTerms.push(...terms);
      }
      if (term) {
          activeTerms.push(term);
      }
      // Deduplicate and filter empty
      const uniqueTerms = [...new Set(activeTerms.map(t => t.trim().toLowerCase()).filter(t => t !== ""))];


      for (const [global_index, tree] of pathsData.entries()) {
          const allLineageNodes = new Set();
          
          for (const currentTerm of uniqueTerms) {
              const termNodes = findLineage(tree, currentTerm);
              termNodes.forEach(node => allLineageNodes.add(node));
          }

          if (allLineageNodes.size > 0) {
              const segments = [];
              if (tree.roots) {
                  tree.roots.forEach(root => {
                      extractLineagePaths(root, allLineageNodes, false, segments);
                  });
              } else if (tree.root) {
                  extractLineagePaths(tree.root, allLineageNodes, false, segments);
              }
              const deduped = dedupeSegments(segments);
              if (deduped.length > 0) {
                  lineageResults[global_index] = deduped;
              }
          }
      }
      postMessage({ type: "search-result", data: lineageResults, id });
    }
    if (data.type === "config") {
      const result = await queryConfig(data);
      // console.log("config result", result);
      postMessage({ type: "config", data: result });
    }

    if (data.type === "local-bins") {
      let result = await getLocalData(data.data.start, data.data.end, data.data.globalBpPerUnit, data.data.nTrees, data.data.new_globalBp, data.data.regionWidth);
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
};
