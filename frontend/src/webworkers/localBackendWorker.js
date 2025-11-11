
import { cleanup } from "../utils/processNewick.js";
import { kn_parse,kn_parse_auto, kn_calxy, kn_expand_node, kn_global_calxy} from "../utils/jstree";
import { Matrix4 } from "@math.gl/core";

console.log("[Worker] Initialized");

postMessage({ data: "Worker starting" });


// Extract the sorted x-array once
function getXArray(globalBins) {
  return globalBins.map(b => b.acc);
}

function distribute(total, spans, alpha = 0.5) {
  const n = spans.length;
  const spacing = 0.05;
  const S = spans.reduce((a, b) => a + b, 0);
  return spans.map(s => total * (alpha * (1 / n) + (1 - alpha) * (s / S)) - spacing);
}

function nearestIndex(arr, x) {
  if (arr.length === 0) return -1;
  if (x <= arr[0]) return 0;
  if (x >= arr[arr.length - 1]) return arr.length - 1;

  const i = lowerBound(arr, x);
  const prev = i - 1;
  return prev;
}

// Main helper: returns the two indices (i0 for x0, i1 for x1)
function findClosestBinIndices(globalBins, x0, x1) {
  const xs = getXArray(globalBins);
  const i0 = nearestIndex(xs, x0);
  const i1 = nearestIndex(xs, x1);
  return { i0, i1 };
}

let basepairPerUnit = 1000;

let ts_intervals = [];


function extractSquarePaths(node, vertical_mode, segments = []) {
  const isVertical = vertical_mode; // cache to avoid repeated lookups

  const nodeX = node.x;
  const nodeY = node.y;

  const children = node.child;
  const nChildren = children?.length || 0;

  if (nChildren > 0) {
    for (let i = 0; i < nChildren; i++) {
      const child = children[i];

      const cX = child.x;
      const cY = child.y;

      // Preallocate small arrays directly; no nested spread copies
      segments.push({
        path: isVertical
          ? [[nodeX, nodeY], [nodeX, cY], [nodeX, cY], [cX, cY]]
          : [[nodeY, nodeX], [cY, nodeX], [cY, nodeX], [cY, cX]],
      });

      extractSquarePaths(child, isVertical, segments);
    }
  } else {
    // Leaf node marker
    segments.push({
      name: node.name,
      position: isVertical ? [node.x, node.y] : [node.y, node.x],
    });
  }

  // Mutations marker
  if (node.mutations) {
    segments.push({
      mutations: node.mutations,
      name: node.name,
      position: isVertical ? [node.x, node.y] : [node.y, node.x],
    });
  }

  return segments;
}


const sendStatusMessage = (status_obj) => {
  postMessage({
    type: "status",
    data: status_obj,
  });
};

let globalBins = [];

let tsconfig = null;


let lastStart = null;
let lastEnd = null;

function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

function upperBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

let intervalKeys = [];
let newLocalBins = new Map();

async function getLocalData(start, end, globalBpPerUnit, nTrees, new_globalBp) {
  // if (!(localBins instanceof Map)) localBins = new Map();

  let scaleFactor = new_globalBp/globalBpPerUnit
  const buffer = scaleFactor > 1 ? 0.01 : 0.0001;
  const bufferStart = Math.max(0, start - start * buffer);
  const bufferEnd = end + end * buffer;

  if (intervalKeys.length === 0) return { local_bins: new Map(), rangeArray: [] };

  // const lower_bound = lowerBound(intervalKeys, bufferStart);
  const lower_bound = nearestIndex(intervalKeys, bufferStart);
  const upper_bound = upperBound(intervalKeys, bufferEnd);

  const local_bins = new Map();

  // ────────────────────────────────
  // Utility to quickly add bins
  // ────────────────────────────────
  const addBins = (lo, hi) => {
    for (let i = lo; i <= hi; i++) {
      const temp_bin = tsconfig.new_intervals[intervalKeys[i]];
      if (!temp_bin) continue;
      local_bins.set(i, {
        s: temp_bin[0],
        e: temp_bin[1],
        path: null,
        global_index: i
      });
    }
  };

  const deleteBins = (lo, hi) => {
    for (let i = lo; i <= hi; i++) {
      local_bins.delete(i);
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

    // if (lower_bound > lastStart) {
    //   console.log("delete bins lower", lastStart, lower_bound - 1);
    //   // deleteBins(lastStart, lower_bound - 1);
    // }
    // if (upper_bound < lastEnd) {
    //   console.log("delete bins upper", upper_bound + 1, lastEnd);
    //   // deleteBins(upper_bound + 1, lastEnd);
    // }
    // Overlapping → reuse bins where possible
    for (let i = lower_bound; i <= upper_bound; i++) {
      if (!newLocalBins.has(i)) {

        const temp_bin = tsconfig.new_intervals[intervalKeys[i]];
        if (temp_bin) {
          local_bins.set(i, {
            s: temp_bin[0],
            e: temp_bin[1],
            path: null,
            global_index: i
          });
        }
      } else {
        local_bins.set(i, newLocalBins.get(i));
      }
    }
  }

  // ────────────────────────────────
  // Sampling / range computation
  // ────────────────────────────────
  const {return_local_bins, displayArray} = new_complete_experiment_map(local_bins,  globalBpPerUnit, new_globalBp);

  lastStart = lower_bound;
  lastEnd = upper_bound;
  newLocalBins = return_local_bins;

  return { local_bins: return_local_bins, lower_bound, upper_bound, displayArray};
}

export const queryConfig = async (data) => {
  
  try {
    tsconfig = data.data;
    intervalKeys = Object.keys(tsconfig.new_intervals)
    .map(Number)

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



// preallocate a reusable Matrix4 to avoid GC churn
const tempMatrix = new Matrix4();

export function new_complete_experiment_map(localBins, globalBpPerUnit, new_globalBp) {

  const spacing = 1.05;
  const bins = new Map();            // replaces plain object

  const displayArray = [];

  const scaleFactor = new_globalBp / globalBpPerUnit;
  const localBpPerBin = new_globalBp;
  const approxEqual = Math.abs(scaleFactor - 1) < 1e-6;

  let prevBinEnd = -1;

  // ────────────────────────────────
  // PASS 1: group local bins
  // ────────────────────────────────
  for (const [key, bin] of localBins.entries()) {
    const { s, e } = bin;
    let binIdxEnd = Math.floor(s / localBpPerBin);
    const span = e - s;

    if (span < localBpPerBin && prevBinEnd !== -1) {
      const endBinIdx = Math.floor(e / localBpPerBin);
      if (endBinIdx === binIdxEnd) prevBinEnd = binIdxEnd;
    }

    const group = bins.get(binIdxEnd) || { indexes: [], spans: [] };
    group.indexes.push(Number(key));
    group.spans.push(span);
    bins.set(binIdxEnd, group);
  }

  // ────────────────────────────────
  // PASS 2: compute transforms
  // ────────────────────────────────

  for (const [binKey, { indexes, spans }] of bins.entries()) {
    const n = indexes.length;

    // ── Single-bin group (fast path)
    if (n === 1) {
      const idx = indexes[0];
      const bin = localBins.get(idx);
      if (!bin) continue;

      const { s, e, path } = bin;
      const span = e - s;
      const dividePos = s / globalBpPerUnit;
      const scaleX = span / (globalBpPerUnit * spacing);

      // if (!path) rangeArray.push({ global_index: idx });

      const modelMatrix = tempMatrix.clone()
        .translate([dividePos, 0, 0])
        .scale([scaleX, 1, 1]);

      localBins.set(idx, {
        ...bin,
        modelMatrix,
        visible: true,
        position: s,
        span
      });

      displayArray.push(idx);

      continue;
    }

    // ── Approx-equal case (scaleFactor ~ 1)
    if (approxEqual) {
      let totalSpan = 0;
      for (let i = 0; i < n; i++) totalSpan += spans[i];
      const binStart = localBins.get(indexes[0]).s;

      // distribute proportional scales
      const dist_scales = distribute(totalSpan, spans, 1);
      let pos = binStart;

      for (let i = 0; i < n; i++) {
        const idx = indexes[i];
        const bin = localBins.get(idx);
        if (!bin) continue;

        const dividePos = pos / globalBpPerUnit;
        const scaleX = dist_scales[i] / (globalBpPerUnit * spacing);

        const modelMatrix = tempMatrix.clone()
          .translate([dividePos, 0, 0])
          .scale([scaleX, 1, 1]);

        localBins.set(idx, {
          ...bin,
          modelMatrix,
          visible: true,
          position: pos,
          span: totalSpan
        });

        displayArray.push(idx);

        pos += dist_scales[i];
      }
      continue;
    }

    // ── Coarser scaling case (scaleFactor ≠ 1)
    let maxSpan = spans[0];
    let maxIdx = indexes[0];
    let totalSpan = spans[0];
    for (let i = 1; i < n; i++) {
      totalSpan += spans[i];
      if (spans[i] > maxSpan) {
        maxSpan = spans[i];
        maxIdx = indexes[i];
      }
    }

    const binStart = localBins.get(indexes[0]).s;
    const translateX = binStart / globalBpPerUnit;
    const scaleX = totalSpan / (globalBpPerUnit * (spacing));

    for (let i = 0; i < n; i++) {
      const idx = indexes[i];
      const bin = localBins.get(idx);
      if (!bin) continue;

      if (idx === maxIdx) {

        const modelMatrix = tempMatrix.clone()
          .translate([translateX, 0, 0])
          .scale([scaleX, 1, 1]);

        localBins.set(idx, {
          ...bin,
          modelMatrix,
          visible: true,
          position: binStart,
          span: totalSpan
        });
        displayArray.push(idx);
      } else {
        // deactivate others in this group
        localBins.set(idx, {
          ...bin,
          modelMatrix: null,
          visible: false,
          position: null,
          span: null,
          path: null
        });
      }
    }
  }

  return { return_local_bins:localBins, displayArray };
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

function processNewick(nwk_str, mutations, globalMinTime, globalMaxTime, times) {
  let ladderize = true;
  let start_time = times['end']
  
  // const tree = kn_parse(nwk_str)
  const tree = kn_parse_auto(nwk_str)

  function assignNumTips(node) {
    if (node.child.length === 0) {
      node.num_tips = 1;
    } else {
      node.num_tips = 0;
      node.child.forEach((child) => {
        node.num_tips += assignNumTips(child);
      });
    }
    return node.num_tips;
  }

  function sortWithNumTips(node) {
    node.child.sort((a, b) => {
      return a.num_tips - b.num_tips;
    });
    node.child.forEach((child) => {
      sortWithNumTips(child);
    });
  }

  function assignMutations(node){
    if (mutations && mutations.hasOwnProperty(node.name)) {
      node.mutations = mutations[node.name]
    }
    if(node.child.length > 0){ 
      node.child.forEach((child) => {
        assignMutations(child);
      })
    }
  }

  assignNumTips(tree.root);
  assignMutations(tree.root);

  const total_tips = tree.root.num_tips;

  if (ladderize) {
    sortWithNumTips(tree.root);
    tree.node = kn_expand_node(tree.root);
  }

  // kn_calxy(tree, true);
  kn_global_calxy(tree, true, globalMinTime, globalMaxTime, start_time)
  // sort on y:
  tree.node.sort((a, b) => a.y - b.y);
  cleanup(tree);

  return tree
}


export async function globalCleanup(allTrees) {
  const emptyList = []; // Define your default mutation list or placeholder

  // Step 1: Assign node_id and collect all x/y values
  let all_x = [];
  let all_y = [];

  for (const tree of allTrees) {
    tree.node.forEach((node, i) => {
      node.node_id = i;
      all_x.push(node.x);
      all_y.push(node.y);
    });
  }

  // Step 2: Compute global scale factors
  all_x.sort((a, b) => a - b);

  const ref_x = all_x.length > 0 ? all_x[Math.floor(all_x.length * 0.99)] : 1;
  const scale_x = 450 / ref_x;

  const min_y = all_y.reduce((min, y) => Math.min(min, y), Infinity);
  const max_y = all_y.reduce((max, y) => Math.max(max, y), -Infinity);
  const scale_y =  1;

  // Step 3: Normalize and flatten each tree safely
  for (let t = 0; t < allTrees.length; t++) {
    const tree = allTrees[t];
    const x_offset = t * 500; // Optional horizontal spacing between trees

    const originalNodes = tree.node; // Preserve reference to full objects

    tree.node = originalNodes.map((node) => {
      const node_name = node.name?.replace(/'/g, "") || "";

      const to_return = {
        name: node_name,
        parent_id: node.parent ? node.parent.node_id : node.node_id,
        x_dist: node.x * scale_x + x_offset,
        y: (node.y - min_y) * scale_y,
        mutations: emptyList,
        num_tips: node.num_tips,
        is_tip: node.child.length === 0,
        node_id: node.node_id,
      };

      if (node.meta) {
        parseNewickKeyValue(node.meta, to_return);
      }

      return to_return;
    });
  }
}

function processData(localTrees, sendStatusMessage, vertical_mode) {
  const paths = {};

  if (Array.isArray(localTrees)) {
    localTrees.forEach((tree, index) => {
      const processedTree = processNewick(
        tree.newick,
        tree.mutations,
        tree.max_time,
        tree.min_time,
        tree.time_range,
        tree.populations
      );

      paths[tree.global_index] = extractSquarePaths(processedTree.root, vertical_mode);
    });
  }

  return paths;
}

onmessage = async (event) => {
  //Process uploaded data:
  console.log("Worker onmessage");
  const { data } = event;

  if (data.type === "upload")
  {
    console.log("upload value: TO IMPLEMENT")

  } else {
    if (data.type === "query") {

      const result = await queryNodes(data.data.tree_dict, data.vertical_mode);
      postMessage({ type: "query", data: result });
    }
    if (data.type === "search") {
      console.log("search : TO IMPLEMENT")
    }
    if (data.type === "config") {
      const result = await queryConfig(data);
      // console.log("config result", result);
      postMessage({ type: "config", data: result });
    }

    if (data.type === "local-bins") {
      let result = await getLocalData(data.data.start, data.data.end, data.data.globalBpPerUnit, data.data.nTrees, data.data.new_globalBp);
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