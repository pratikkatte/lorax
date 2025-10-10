
import { cleanup } from "../utils/processNewick.js";
import { kn_parse,kn_parse_auto, kn_calxy, kn_expand_node, kn_global_calxy} from "../utils/jstree";
import { Matrix4 } from "@math.gl/core";

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


function extractSquarePaths(node, vertical_mode, populations) {
  const segments = [];

  if (node.child.length>0) {
    node.child.forEach(child => {
      segments.push({
        path: [[node.y, node.x], [child.y, node.x], [child.y, node.x],[child.y, child.x]]
      })
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

async function getLocalData(
  start, end, localBins, globalBpPerUnit, nTrees, new_globalBp
) {
  const bins = localBins;
  const buffer = 0.01;
  const bufferStart = Math.max(0, start - start * buffer);
  const intervalKeys = Object.keys(tsconfig.new_intervals)
    .map(Number)
    .sort((a, b) => a - b);
  if (intervalKeys.length === 0) return { local_bins: {}, rangeArray: [] };

  const bufferEnd = Math.min(intervalKeys.length - 1, end + end * buffer);
  const lower_bound = lowerBound(intervalKeys, bufferStart);
  const upper_bound = upperBound(intervalKeys, bufferEnd);

  const addBins = (lo, hi) => {
    for (let i = lo; i <= hi; i++) {
      const temp_bin = tsconfig.new_intervals[intervalKeys[i]];
      bins[i] = { s: temp_bin[0], e: temp_bin[1], path: null, global_index: i };
    }
  };

  // region management
  if (lastStart == null || lastEnd == null || upper_bound < lastStart || lower_bound > lastEnd) {
    Object.keys(bins).forEach(k => delete bins[k]);
    addBins(lower_bound, upper_bound);
  } else {
    if (lower_bound > lastStart) for (let i = lastStart; i < lower_bound; i++) delete bins[i];
    if (lower_bound < lastStart) addBins(lower_bound, lastStart - 1);
    if (upper_bound > lastEnd) addBins(lastEnd + 1, upper_bound);
    if (upper_bound < lastEnd) for (let i = lastEnd; i > upper_bound; i--) delete bins[i];
  }

  const { rangeArray } = complete_new_sampling(bins, globalBpPerUnit, nTrees, new_globalBp);
  // const { rangeArray } = new_complete_experiment(bins, globalBpPerUnit, new_globalBp);
  lastStart = lower_bound;
  lastEnd = upper_bound;
  return { local_bins: bins, rangeArray };
};


export const queryConfig = async (data) => {
  
  try {
    tsconfig = data.data;
    // const global_bins_linear = getGlobalBins_linear(data.data, data.globalBpPerUnit);

    // globalBins = global_bins_linear;

    return;
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

function new_complete_experiments(localBins, globalBpPerUnit, new_globalBp) {

  const bins = {};
  const rangeArray = [];
  const scaleFactor = new_globalBp / globalBpPerUnit;
  let localBpPerBin = new_globalBp;
  let prevBinEnd = null;
  for (const key in localBins) {
    const s = localBins[key].s;

    let binIdxEnd = Math.floor(s / localBpPerBin);

    const span = localBins[key].e - localBins[key].s;
    if (span < localBpPerBin && prevBinEnd !== null) {
      binIdxEnd = prevBinEnd;
    }
    bins[binIdxEnd] = {
      indexes: [...(bins[binIdxEnd]?.indexes || []), key],
      span: [...(bins[binIdxEnd]?.span || []), Number(span)]
    };
    prevBinEnd = binIdxEnd;
  }

  for (const key in bins) {
    if (bins[key].indexes.length == 1) {
      const index = bins[key].indexes[0];
      const span = localBins[index].e - localBins[index].s;
      const dividePos = localBins[index].s / globalBpPerUnit;
      const scaleX = span / (globalBpPerUnit * 1.05);

      if (!localBins[index].path){
        rangeArray.push({ global_index: parseInt(index) });
      }

      const modelMatrix = new Matrix4()
        .translate([dividePos, 0, 0])
        .scale([scaleX, 1, 1]);

      localBins[index] = {
        ...localBins[index],
        position: localBins[index].s,
        span: span,
        modelMatrix,
        visible: true,
        // bin_start: localBins[index].s,
      }
    }else if (scaleFactor == 1) {
        const total_span = bins[key].span.reduce((a, b) => a + b, 0);
       
        let temp_position = localBins[bins[key].indexes[0]].s;
        const indexes = bins[key].indexes;
        const span_index = bins[key].span;
        const dist_scales = distribute(total_span / globalBpPerUnit, span_index, 1);

        indexes.forEach((idx, i) => {
          const span = localBins[idx].e - localBins[idx].s;
          
          const dividePos = temp_position / globalBpPerUnit;
          // const scaleX = dist_scales[i] / (globalBpPerUnit * 1.05);
          const modelMatrix = new Matrix4()
            .translate([dividePos, 0, 0])
            .scale([dist_scales[i], 1, 1]);
          

            if (!localBins[idx].path) rangeArray.push({ global_index: parseInt(idx) });

            localBins[idx] = {
              ...localBins[idx],
              span: total_span,
              position: temp_position,
              visible: true,
              modelMatrix,
            };
            temp_position += dist_scales[i] * globalBpPerUnit * 1.05;

        });
    }else {
      const indexes = bins[key].indexes;
      const index_span = bins[key].span;
      const maxSpan = Math.max(...index_span);
      const maxIndex = indexes[index_span.indexOf(maxSpan)];
      const total_span = bins[key].span.reduce((a, b) => a + b, 0);
      const binStart = localBins[bins[key].indexes[0]].s;

      
      indexes.forEach((idx) => {

        if (idx === maxIndex) {
          const scaleX = total_span / (globalBpPerUnit * 1.05);

          if (!localBins[idx].path) rangeArray.push({ global_index: parseInt(idx) });

          const modelMatrix = new Matrix4()
            .translate([binStart/globalBpPerUnit, 0, 0])
            .scale([scaleX, 1, 1]);

          localBins[idx] = {
            ...localBins[idx],
            span: total_span,
            bin_start: binStart,
            position: binStart,
            visible: true,
            modelMatrix,
          };

        }else {
          localBins[idx] = {
            ...localBins[idx],
            visible: false,
            span: null,
            position: null,
            modelMatrix: null,
          }
        }
      });
    }
}
return { rangeArray };

}

// import { Matrix4 } from "@math.gl/core";

// preallocate a reusable Matrix4 to avoid GC churn
const tempMatrix = new Matrix4();

export function new_complete_experiment(localBins, globalBpPerUnit, new_globalBp) {
  const bins = Object.create(null);
  const rangeArray = [];
  const scaleFactor = new_globalBp / globalBpPerUnit;
  const localBpPerBin = new_globalBp;

  let prevBinEnd = -1;

  // --- PASS 1: group localBins into coarse bins
  for (const key in localBins) {
    const { s, e } = localBins[key];
    let binIdxEnd = Math.floor(s / localBpPerBin);

    const span = e - s;
    // if (span < localBpPerBin && prevBinEnd !== -1) binIdxEnd = prevBinEnd;

    const bin = bins[binIdxEnd] || (bins[binIdxEnd] = { indexes: [], spans: [] });
    bin.indexes.push(key);
    bin.spans.push(span);

    prevBinEnd = binIdxEnd;
  }

  const approxEqual = Math.abs(scaleFactor - 1) < 1e-6;

  // --- PASS 2: compute transforms
  for (const binKey in bins) {
    const { indexes, spans } = bins[binKey];
    const n = indexes.length;

    if (n === 1) {
      // fast path: single-bin group
      const idx = indexes[0];
      const { s, e, path } = localBins[idx];
      const span = e - s;
      const dividePos = s / globalBpPerUnit;
      const scaleX = span / globalBpPerUnit * 1.05;

      if (!path) rangeArray.push({ global_index: +idx });

      localBins[idx].modelMatrix = tempMatrix.clone()
        .translate([dividePos, 0, 0])
        .scale([scaleX, 1, 1]);

      localBins[idx].visible = true;
      localBins[idx].position = s;
      localBins[idx].span = span;
      continue;
    }

    if (approxEqual) {
      // scaleFactor ~1 case
      let totalSpan = 0;
      for (let i = 0; i < n; i++) totalSpan += spans[i];
      const binStart = localBins[indexes[0]].s;

      // compute proportional scales once
      const dist_scales = distribute(totalSpan, spans, 1);
      let pos = binStart;

      for (let i = 0; i < n; i++) {
        const idx = indexes[i];
        const { path } = localBins[idx];
        const dividePos = pos / globalBpPerUnit;
        const scaleX = dist_scales[i] / globalBpPerUnit * 1.05;

        if (!path) rangeArray.push({ global_index: +idx });

        localBins[idx].modelMatrix = tempMatrix.clone()
          .translate([dividePos, 0, 0])
          .scale([scaleX, 1, 1]);

        localBins[idx].visible = true;
        localBins[idx].position = pos;
        localBins[idx].span = totalSpan;

        pos += dist_scales[i];
      }
      continue;
    }

    // else: coarser scaling
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

    const binStart = localBins[indexes[0]].s;
    const translateX = binStart / globalBpPerUnit;
    const scaleX = totalSpan / globalBpPerUnit * 1.05;

    // assign only to the max index
    for (let i = 0; i < n; i++) {
      const idx = indexes[i];
      if (idx === maxIdx) {
        if (!localBins[idx].path)
          rangeArray.push({ global_index: +idx });

        localBins[idx].modelMatrix = tempMatrix.clone()
          .translate([translateX, 0, 0])
          .scale([scaleX, 1, 1]);

        localBins[idx].visible = true;
        localBins[idx].position = binStart;
        localBins[idx].span = totalSpan;
      } else {
        localBins[idx].visible = false;
      }
    }
  }

  return { rangeArray, localBins };
}


function complete_new_sampling(localBins, globalBpPerUnit, nTrees, new_globalBp) {
  const rangeArray = [];
  let prevBinEndIdx = null;
  let globalBin = null;
  let binStart = 0, binEnd = 0;
  const scaleFactor = new_globalBp / globalBpPerUnit;
  const func_globalBpPerUnit = new_globalBp;

  const finalizeBin = () => {
    if (!globalBin) return;
    const bin_indexes = globalBin.skip_idx;

    // Single-bin case
    if (bin_indexes.length === 1) {
      const global_index = bin_indexes[0];
      const span = localBins[global_index].e - localBins[global_index].s;
      if (!localBins[global_index].path)
        rangeArray.push({ global_index: parseInt(global_index) });

      const dividePos = localBins[global_index].s / globalBpPerUnit;
      const scaleX = span / (globalBpPerUnit * 1.05);
      const modelMatrix = new Matrix4()
        .translate([dividePos, 0, 0])
        .scale([scaleX, 1, 1]);

      localBins[global_index] = {
        ...localBins[global_index],
        bin_start: binStart,
        visible: true,
        span: globalBin.span,
        modelMatrix,
        position: localBins[global_index].s,
      };
      return;
    }

    // Multi-bin case
    const maxSpan = Math.max(...globalBin.index_span);
    const maxIndex = bin_indexes[globalBin.index_span.indexOf(maxSpan)];
    const tmpMatrix = new Matrix4();

    if (scaleFactor === 1) {
      const temp_span = globalBin.span;
      let temp_position = binStart;
      const dist_scales = distribute(temp_span / globalBpPerUnit, globalBin.index_span, 1);
      
      bin_indexes.forEach((idx, i) => {
        const dividePos = temp_position / globalBpPerUnit;
        if (!localBins[idx].path) rangeArray.push({ global_index: parseInt(idx) });

        tmpMatrix.identity()
          .translate([dividePos, 0, 0])
          .scale([dist_scales[i], 1, 1]);
        const modelMatrix = tmpMatrix.clone();

        localBins[idx] = {
          ...localBins[idx],
          span: temp_span,
          bin_start: binStart,
          position: temp_position,
          visible: true,
          modelMatrix,
        };
        temp_position += dist_scales[i] * globalBpPerUnit * 1.05;
      });
    } else {
      bin_indexes.forEach((idx) => {
        if (idx === maxIndex) {
          const scaleX = globalBin.span / (globalBpPerUnit * 1.05);
          const dividePos = binStart / globalBpPerUnit;
          if (!localBins[idx].path) rangeArray.push({ global_index: parseInt(idx) });

          tmpMatrix.identity()
            .translate([dividePos, 0, 0])
            .scale([scaleX, 1, 1]);
          const modelMatrix = tmpMatrix.clone();

          localBins[idx] = {
            ...localBins[idx],
            span: globalBin.span,
            bin_start: binStart,
            position: binStart,
            visible: true,
            modelMatrix,
          };
        } else {
          localBins[idx] = {
            ...localBins[idx],
            visible: false,
            span: null,
            bin_start: null,
            position: null,
            modelMatrix: null,
          };
        }
      });
    }
  };

  for (const key in localBins) {
    if (!Object.prototype.hasOwnProperty.call(localBins, key)) continue;

    const s = localBins[key].s;
    const e = localBins[key].e;
    const span = e - s;
    const binIdxEnd = Math.floor(e / globalBpPerUnit);
    

    if (prevBinEndIdx === null) {
      globalBin = { skip_idx: [key], span, index_span: [span] };
      binStart = s; binEnd = e;
    } else if (binIdxEnd === prevBinEndIdx || globalBin.span < func_globalBpPerUnit) {
      globalBin.skip_idx.push(key);
      globalBin.index_span.push(span);
      binEnd = e;
      globalBin.span = binEnd - binStart;
    } else {
      finalizeBin();
      globalBin = { skip_idx: [key], span, index_span: [span] };
      binStart = s; binEnd = e;
    }
    prevBinEndIdx = binIdxEnd;
  }

  finalizeBin();
  return { rangeArray };
}




export const queryLocalBins = async (start, end, localBins, globalBpPerUnit, nTrees, new_globalBp) => {

  let result = await getLocalData(start, end, localBins, globalBpPerUnit, nTrees, new_globalBp);
  return result;

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
      const result = await queryLocalBins(data.data.start, data.data.end, data.data.localBins, data.data.globalBpPerUnit, data.data.nTrees, data.data.new_globalBp);
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