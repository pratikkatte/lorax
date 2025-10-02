
import { cleanup } from "../utils/processNewick.js";
import { kn_parse,kn_parse_auto, kn_calxy, kn_expand_node, kn_global_calxy} from "../utils/jstree";

console.log("[Worker] Initialized");

// const WebSocket = require('ws');

// const PythonWebSocketClient = require('./PythonWebSocketClient');

// import PythonWebSocketClient from './PythonWebSocketClient.js';
// const pythonClient = new PythonWebSocketClient();

postMessage({ data: "Worker starting" });


// Extract the sorted x-array once
function getXArray(globalBins) {
  return globalBins.map(b => b.acc);
}


function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

function nearestIndex(arr, x) {
  if (arr.length === 0) return -1;
  if (x <= arr[0]) return 0;
  if (x >= arr[arr.length - 1]) return arr.length - 1;

  const i = lowerBound(arr, x);
  // i is first >= x, so candidate neighbors are i-1 and i
  const prev = i - 1;
  return (x - arr[prev] <= arr[i] - x) ? prev : i;
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

function getGlobalBins_linear(data, globalBpPerUnit) {
  // basepairPerUnit = globalBpPerUnit;
  basepairPerUnit = 1;

  const intervals = data.new_intervals;
  ts_intervals = intervals;
  const intervalsKeys = Object.keys(intervals);


  const list = new Array(intervalsKeys.length + 1);
  list[0] = [0, 0];
  for (let i = 0; i < intervalsKeys.length; i++) {
    const k = intervalsKeys[i];
    list[i] = intervals[k];
  }
  const out = new Array(intervalsKeys.length);
  let acc = 0;
for (let i = 0; i < intervalsKeys.length; i++) {
  
    const [s, e] = list[i];
    acc = (e/basepairPerUnit);
    out[i] = {s, e, acc};
  }
  return out;
}

const the_cache = {};


function extractSquarePaths(node, vertical_mode) {
  const segments = [];

  if (node.child.length>0) {
    node.child.forEach(child => {
      // Horizontal segment from parent to child x at parent y
      // Vertical drop to child's y
      segments.push({
        path: vertical_mode ? [[node.x, node.y], [node.x, child.y]] : [[node.y, node.x], [child.y, node.x]]
      });
      segments.push({
        path: vertical_mode ?[[node.x, child.y],[child.x, child.y]]: [[child.y, node.x],[child.y, child.x]]
      });
      segments.push(...extractSquarePaths(child, vertical_mode));
    });
  } else {
    segments.push({
      name: node.name,
      position: vertical_mode ? [node.x, node.y] : [node.y, node.x],
    })
  }
  if(node.mutations) {
    if(vertical_mode){
      segments.push({ mutations: node.mutations,name: node.name, position:[node.x, node.y]})
    }else{
      segments.push({ mutations: node.mutations,name: node.name, position:[node.y, node.x]})
    }
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

export const queryConfig = async (data) => {
  
  try {

    if (data.globalBpPerUnit) {
    }
    const global_bins_linear = getGlobalBins_linear(data.data, data.globalBpPerUnit);

    globalBins = global_bins_linear;

    return global_bins_linear;
  } catch (error) {
    console.log("error", error);
  }
}

let cachedBins = [];
let cachedLo = null;
let cachedHi = null;

function buildBins(globalBins, lo, hi) {
  const arr = [];
  for (let i = lo; i <= hi; i++) arr.push(makeBin(globalBins[i], i));
  return arr;
}

function makeBin(bin, index) {
  return {
    start: bin.s,
    index,
    end: bin.e,
    sourcePosition: [bin.acc, 0],
    targetPosition: [bin.acc, 2],
  };  
}

const skip_threshold = 1000;
const new_skip_threshold = 100;


// function optimized_new_buildBins(globalBins, lo, hi, skip_threshold) {

//   const arr = [];
//   let prevEnd = null;

//   let skipBuffer = [];
//   let groupStart = null; 
//   let groupEnd = null;  
//   let j = lo;
//   for (let i = lo; i <= hi; i++) {
    
//     const bin = globalBins[i];
//     const end = bin.e;
//     const start = bin.s;

//     const diff = prevEnd !== null ? end - prevEnd : Infinity;
//     const visible = diff >= new_skip_threshold;

//     if (visible) {
//       if (skipBuffer.length > 0 && arr.length > 0) {
//         const last = arr[arr.length - 1];
//         last.trees_index = [...skipBuffer];
//         last.number_of_skips = skipBuffer.length;
//         last.visibility = false;
//         last.end = groupEnd; // extend the end of the last group
//         skipBuffer = [];
//       }

//       arr.push({
//         start,
//         end,
//         trees_index: [],
//         number_of_skips: 0,
//         visibility: true,
//         index: j,
//         global_index: i,
//       });
//       j++;

//       groupStart = start;
      
//     } else {
//       if (skipBuffer.length == 0) {
//         arr.push({
//           start,
//           end,
//           trees_index: [i],
//           number_of_skips: 1,
//           visibility: false,
//           global_index: null,
//           index: j,
//         })
//         j++;
//         groupStart = start;
//         skipBuffer.push(i);
//       } 
//       else {
//         skipBuffer.push(i);
//       }
      
//     }
//     groupEnd = end;
//     prevEnd = end;
//   }

//   return arr;
// }

export const queryValueChanged = async (value) => {
  const [x0, x1] = value;
  const { i0, i1 } = findClosestBinIndices(globalBins, x0, x1);
  return { i0, i1 };
}

export const queryLocalBins = async (value) => {

  // let [lo, hi] = globalBinsIndexes;

  let new_exp_local_bins = queryExperimental(value)

  let { i0, i1 } = findClosestBinIndices(globalBins, value[0]/basepairPerUnit, value[1]/basepairPerUnit);

  let lo = i0;
  let hi = i1;
  
  // const new_bins = optimized_new_buildBins(globalBins, lo, hi, new_skip_threshold);

  // TODO optimize on this for increasing and decreasing local bins based on user interaction
  if (lo > hi) return [];

  // const localBins = globalBins.slice(lo, hi+1);
  const interval = hi - lo + 1;
  const buffer = interval;
  // const buffer = 0;

  const loBuffered = Math.max(0, lo - buffer);
  const hiBuffered = Math.min(globalBins.length - 1, hi + buffer);

  // If no cache yet, build fresh
  if (cachedLo === null || cachedHi === null) {
    cachedBins = buildBins(globalBins, loBuffered, hiBuffered);
    cachedLo = loBuffered;
    cachedHi = hiBuffered;

  } else {
    // Expand left
    while (loBuffered < cachedLo) {
      cachedLo--;
      cachedBins.unshift(makeBin(globalBins[cachedLo], cachedLo));
    }
    // Expand right
    while (hiBuffered > cachedHi) {
      cachedHi++;
      cachedBins.push(makeBin(globalBins[cachedHi], cachedHi));
    }
    // Shrink left
    while (loBuffered > cachedLo) {
      cachedBins.shift();
      cachedLo++;
    }
    // Shrink right
    while (hiBuffered < cachedHi) {
      cachedBins.pop();
      cachedHi--;
    }
  }

  // const local_bins = globalBins.slice(loBuffered, hiBuffered);

  let maxX = globalBins[hi+1].acc
  let minX = globalBins[lo].acc

  // Tag bins as visible:false if the difference between .end of consecutive bins is small
  // We'll mark bins as visible:false if their .end is the same as the previous bin's .end
  
  if (cachedBins.length > 1) {
    let prevEnd = cachedBins[0].end;
    cachedBins[0].visible = true;
    for (let i = 1; i < cachedBins.length; i++) {
      if (cachedBins[i].end - prevEnd <= skip_threshold) {
        cachedBins[i].visible = false;
      } else {
        cachedBins[i].visible = true;
        prevEnd = cachedBins[i].end;
      }
    }
  }
  // return {local_bins: cachedBins, new_bins: new_bins};
  // return {local_bins: new_bins};
  return {local_bins: new_exp_local_bins};

}
export const queryNodes = async (data, vertical_mode) => {
  try {
    const received_data = JSON.parse(data);

    const localTrees = received_data.tree_dict;
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



//function to find the closes the genomic interval in the ts_intervals. Returns indices.  

function findClosestGenomicInterval(genomic_coords) {

  const xs = Object.keys(ts_intervals);
  const first_genomic_index = nearestIndex(xs, genomic_coords[0]);
  const last_genomic_index = nearestIndex(xs, genomic_coords[1]);

  return { first_genomic_index, last_genomic_index };
}

export function queryExperimental(data) {
  

  // work with the genomic coodinates itself, insteaed of world-coordinates. 

  var {first_genomic_index, last_genomic_index} = findClosestGenomicInterval(data);

  // var local_bins = globalBins.slice(first_genomic_index, last_genomic_index+1);

  // for (let i = first_genomic_index; i <= last_genomic_index; i++) {
  //   local_bins.push(globalBins[i]);
  // }
  return [first_genomic_index, last_genomic_index];
  // return [local_bins];
   
//   // last_genomic_index > possible_num_trees? possible_num_trees : last_genomic_index
//   let possible_num_trees = (data[1]/basepairPerUnit) - ((data[0]/basepairPerUnit) > 0? (data[0]/basepairPerUnit) : 0);
//   possible_num_trees = last_genomic_index > possible_num_trees? Math.round(possible_num_trees * 0.5) : last_genomic_index;

//   const indices = downSample(first_genomic_index, last_genomic_index, possible_num_trees);

//   let local_bins = [];
//   let prev_ind = null;
//   let tree_index = (globalBins[indices[0]].s)/basepairPerUnit;
//   for (let i = 0; i < indices.length; i++) {
//     let bins = globalBins[indices[i]];

//     if (i>0 ) {
//       let num_skips = (indices[i]-1 - prev_ind)
//       num_skips = prev_ind !== null ? num_skips > 1 ? num_skips : 0 : 0
//       local_bins.push({
//         start: globalBins[prev_ind+1].s,
//         end: globalBins[indices[i]-1].e,
//         trees_index: Array.from(
//           { length: indices[i]-1 - prev_ind },
//           (_, k) => prev_ind + k + 1
//         ),
//         number_of_skips: num_skips,
//         visibility: num_skips > 0 ? false : true,
//         global_index: null,
//         index: tree_index,
//       })
//       tree_index++;
//     }
    
//     local_bins.push({
//       start: bins.s,
//       end: bins.e,
//       trees_index: [],
//       number_of_skips: 0,
//       visibility: true,
//       global_index: indices[i],
//       index: tree_index,
//     })
//     tree_index++;
//     prev_ind = indices[i];
//   }
// // last genomic index should be greater than possible_num_trees, else genomic_index
// let world_coords = [data[0]/basepairPerUnit, data[1]/basepairPerUnit];
// console.log("queryExperimental", local_bins, data,world_coords, indices, first_genomic_index, last_genomic_index);

//   return local_bins;

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
        tree.time_range
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
      const result = await queryNodes(data.data, data.vertical_mode);
      postMessage({ type: "query", data: result });
    }
    if (data.type === "search") {
      console.log("search : TO IMPLEMENT")
    }
    if (data.type === "config") {
      const result = await queryConfig(data);
      console.log("config result", result);
      postMessage({ type: "config", data: result });
    }

    if (data.type === "local-bins") {
      const result = await queryLocalBins(data.data);
      postMessage({ type: "local-bins", data: result });
  }

    if (data.type === "value-changed") {
      const result = await queryValueChanged(data.data);
      postMessage({ type: "value-changed", data: result });
    }

    if (data.type === "details") {
      console.log("data details value: TO IMPLEMENT")
    }
  
    if (data.type === "experimental"){
      const result = await queryExperimental(data.data);
      console.log("experimental result", result);
      // postMessage({ type: "experimental", data: result });
    }
  }
};