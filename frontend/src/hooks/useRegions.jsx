import { useMemo, useEffect, useState, useRef } from "react";
import debounce from "lodash.debounce";
import memoizeOne from "memoize-one";
import { Matrix4 } from "@math.gl/core";

function niceStep(step) {
  const exp = Math.floor(Math.log10(step));
  const base = Math.pow(10, exp);
  const multiples = [1, 2, 5, 10];
  for (let m of multiples) if (step <= m * base) return m * base;
  return multiples[multiples.length - 1] * base;
}

const getLocalCoordinates = memoizeOne((lo, hi) => {
  const range = hi - lo;
  const divisions = range > 1000 ? 5 : 10;
  const rawStep = range / divisions;
  const stepSize = niceStep(rawStep);

  const start = Math.ceil(lo / stepSize) * stepSize;
  const end   = Math.floor(hi / stepSize) * stepSize;
  const n = Math.floor((end - start) / stepSize) + 1;

  return Array.from({ length: n }, (_, i) => {
    const x = start + i * stepSize;
    return { x, y: 0, text: x };
  });
});

function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

function distribute(total, spans, alpha = 0.5) {
  const n = spans.length;
  const spacing = 0.05
  const S = spans.reduce((a, b) => a + b, 0);
  return spans.map(s => (total *(alpha * (1 / n) + (1 - alpha) * (s / S))) - spacing
  );
}

function complete_new_sampling(localBins, globalBpPerUnit, nTrees, new_globalBp) {


  const rangeArray = [];


  let prevBinEndIdx = null;
  let globalBin = null;

  let skipCount = 0;
  let binStart = 0;
  let binEnd = 0;

  let scaleFactor = new_globalBp / globalBpPerUnit;
  

  let func_globalBpPerUnit = new_globalBp;
  const finalizeBin = () => {
    try {

    if (!globalBin) return;


    let bin_indexes = globalBin.skip_idx;

    if (bin_indexes.length == 1) {
      let global_index = bin_indexes[0];

      let span = localBins[global_index].e - localBins[global_index].s;
      // localBins[global_index].visible = true;
      localBins[global_index]?.path == null && rangeArray.push({ global_index: parseInt(global_index) });
      const centerX = 0;
      const scaleX = span/(globalBpPerUnit*1.05);
      const dividePos = localBins[global_index].s / globalBpPerUnit;

      const modelMatrix = new Matrix4()
      .translate([dividePos, 0, 0])
      .translate([centerX, 0, 0])
      .scale([scaleX, 1, 1])
      .translate([-centerX, 0, 0]);

      localBins[global_index] = {
        ...localBins[global_index],
        bin_start: binStart,
        visible: true,
        span: globalBin.span,
        modelMatrix,
        position: localBins[global_index].s,
      };
    } 
    else {

      
      let maxIndex = globalBin.skip_idx[globalBin.index_span.indexOf(Math.max(...globalBin.index_span))];
      if (scaleFactor == 1){
        let len_idx = bin_indexes.length;
        let temp_span = globalBin.span;
        let scaleX = temp_span/(globalBpPerUnit*1.05)/len_idx;
        let temp_position = binStart;
        let centerX = 0;
        let temp_bin_start = binStart;

        let dist_scales = distribute(temp_span/globalBpPerUnit, globalBin.index_span,  Math.min((nTrees/len_idx), 1));
        // console.log("scalex", scaleX, bin_indexes, globalBin.index_span, temp_position, dist_span, nTrees, len_idx, Math.min(0.5 + (len_idx/nTrees), 1));
        bin_indexes.forEach((idx, i) => {

          const dividePos = temp_position / globalBpPerUnit;
          localBins[idx]?.path == null && rangeArray.push({ global_index: parseInt(idx) });

          const modelMatrix = new Matrix4()
          .translate([dividePos, 0, 0])
          .translate([centerX, 0, 0])
          .scale([dist_scales[i], 1, 1])
          .translate([-centerX, 0, 0]);

          localBins[idx] = {
            ...localBins[idx],
            span: temp_span,
            bin_start: temp_bin_start,
            position: temp_position,
            visible: true,
            modelMatrix: modelMatrix,
          };

          temp_position += dist_scales[i]*globalBpPerUnit*1.05;

        })
      }
      else{
        

      bin_indexes.forEach((idx) => {

        if (idx == maxIndex) {

          let temp_span = globalBin.span;
          let temp_bin_start = binStart;
          let temp_position = binStart;

          let centerX = 0;
          // let scaleX = (localBins[idx].e - localBins[idx].s)/(globalBpPerUnit*1.05);
          // let scaleX = 0.6;
          let scaleX = temp_span/(globalBpPerUnit*1.05);
          const dividePos = temp_position / globalBpPerUnit;

          localBins[idx]?.path == null && rangeArray.push({ global_index: parseInt(idx) });

        const modelMatrix = new Matrix4()
        .translate([dividePos, 0, 0])
          .translate([centerX, 0, 0])
          .scale([scaleX, 1, 1])
          .translate([-centerX, 0, 0])
          

          localBins[idx] = {
            ...localBins[idx],
            span: temp_span,
            bin_start: temp_bin_start,
            position: temp_position,
            visible: true,
            modelMatrix: modelMatrix,
          };
        } else{

          localBins[idx].visible = false;
          localBins[idx].span = null;
          localBins[idx].bin_start = null;
          localBins[idx].position = null;
          localBins[idx].modelMatrix = null;
        }
 

      });
    }
      // let maxIndex = globalBin.skip_idx[globalBin.index_span.indexOf(Math.max(...globalBin.index_span))];
      
      // globalBin.skip_idx.forEach((idx) => {
      //   if (idx == maxIndex) {
          
      //     localBins[idx].visible = true;
      //     localBins[idx]?.path == null && rangeArray.push({ global_index: parseInt(idx) });
          
      //     const centerX = 0;
      //     let local_span = localBins[idx].e - localBins[idx].s;
      //     const scaleX = local_span/(globalBpPerUnit*1.05);
      //     const dividePos = localBins[idx].s / globalBpPerUnit;

      //     const modelMatrix = new Matrix4()
      //     .translate([dividePos, 0, 0])
      //     .translate([centerX, 0, 0])
      //     .scale([scaleX, 1, 1])
      //     .translate([-centerX, 0, 0]);

      //     localBins[idx] = {
            
      //       ...globalBin,
      //       bin_start: binStart,
      //       global_span: globalBin.span,
      //       span: local_span,
      //       skip_index: globalBin.skip_idx,

      //       ...localBins[idx],
            
      //       modelMatrix,
      //       position: localBins[idx].s,


      //     };
      //   }else{
      //     localBins[idx].visible = false;
      //     localBins[idx].parent_index = maxIndex;
      //     localBins[idx].skip_index = [];
          // localBins[idx].visible = false;
          // localBins[idx].span = localBins[idx].e - localBins[idx].s;
          // localBins[idx].position = localBins[idx].s;
          // localBins[idx].modelMatrix = null;
          
        // }

      // });
    }

    // globalBin.skip = skipCount;
    // globalBin.span = span;
    // // globalBin.visible = span > globalBpPerUnit;
    // globalBin.visible = span > func_globalBpPerUnit;
    
    // // TODO: if all the skipped_indexes fit inside the span, then set the visible to true
    // // TODO at scale factor 1 and based on nTrees, adjust the scaleX less than 1. 
    

    // if (globalBin.visible && localBins[globalBinIdx]?.path == null) {
    //   rangeArray.push({ global_index: parseInt(globalBinIdx) });
    // }

    // const centerX = 0;
    // const scaleX = skipCount == 1 ? span/(globalBpPerUnit*1.05) : 1;
    // const dividePos = binStart / globalBpPerUnit;

    // const modelMatrix = new Matrix4()
    //   .translate([dividePos, 0, 0])
    //   .translate([centerX, 0, 0])
    //   .scale([scaleX, 1, 1])
    //   .translate([-centerX, 0, 0]);


    // localBins[globalBinIdx] = {
    //   ...localBins[globalBinIdx],
    //   ...globalBin,
    //   modelMatrix,
    //   position: binStart,
    // };
    }
    catch (error) {
      console.log("error in finalizeBin", error);
    }
  };

  
  for (const key in localBins) {
    if (!Object.prototype.hasOwnProperty.call(localBins, key)) continue;

    const s = localBins[key].s;
    const e = localBins[key].e;
    const span = e - s;
    const binIdxStart = Math.floor(s / globalBpPerUnit);
    const binIdxEnd = Math.floor(e / globalBpPerUnit);

    if (prevBinEndIdx === null) {
      // first bin
      globalBin = { skip: 0, skip_idx: [key], span, index_span: [span] };
      binStart = s;
      binEnd = e;
    } else if (binIdxEnd == prevBinEndIdx || globalBin.span < func_globalBpPerUnit) {
      // merge with current global bin
      skipCount++;
      globalBin.skip_idx.push(key);
      globalBin.index_span.push(span)
      // localBins[key].visible = false;
      // localBins[key].span = span;
      binEnd = e;
      globalBin.span = binEnd - binStart;
    } else {
      // close out current bin and start a new one
      finalizeBin();
      skipCount = 0;
      globalBin = { skip: 0, skip_idx: [key], span, index_span: [span] };
      binStart = s;
      binEnd = e;
    }

    prevBinEndIdx = binIdxEnd;
  }

  // finalize last one
  finalizeBin();

  return { temp_bins: localBins, rangeArray };
}


function new_modified_sampleTrees(globalBins, lo, hi, globalBpPerUnit, nTrees, new_globalBp) {
  const sampled_trees = {};
  let i = lo;

  let localBpPerUnit = new_globalBp;
  let scaleFactor = localBpPerUnit / globalBpPerUnit;

  // console.log("new_modified_sampleTrees scaleFactor", scaleFactor);

  while (i <= hi) {
    const startBin = globalBins[i];
    const groupStart = startBin.s;
    let groupEnd = startBin.e;
    const skip_index = [];
    const j = i;

    i++;

    // Merge bins until span exceeds globalBpPerUnit
    while (i <= hi && globalBins[i].s - groupStart <= localBpPerUnit) {
      groupEnd = globalBins[i].e;
      skip_index.push(i);
      i++;
    }

    const span_total = groupEnd - groupStart;

    // If the merged span is too wide, split into individual bins
    if (span_total > (skip_index.length + 1) * localBpPerUnit) {

      const centerX = 0;
      const scaleX = scaleFactor;
      // const scaleX = 5;
      const divide_pos = groupStart / globalBpPerUnit;
      
      const modelMatrix = new Matrix4()
      .translate([divide_pos, 0, 0])   
      .translate([centerX, 0, 0])       
      .scale([scaleX, 1, 1])            
      .translate([-centerX, 0, 0]);     

      sampled_trees[j] = {
        index: j,
        global_index: j,
        position: groupStart,
        span: globalBins[j].e - globalBins[j].s,
        skip_index: [],
        skip_count: 0,
        visible: true,
        padding: 0,
        modelMatrix
      };

      for (let k = 0; k < skip_index.length; k++) {
        const centerX = 0;
        const scaleX = scaleFactor;
        // const scaleX = 5;
      const divide_pos = (groupStart + ((k + 1) * localBpPerUnit)) / globalBpPerUnit;
      const modelMatrix = new Matrix4()
      .translate([divide_pos, 0, 0])    // move to world coordinate
      .translate([centerX, 0, 0])       // shift origin to local center
      .scale([scaleX, 1, 1])            // shrink only in X
      .translate([-centerX, 0, 0]);     // shift back

        const idx = skip_index[k];
        sampled_trees[idx] = {
          index: idx,
          global_index: idx,
          position: groupStart + (k + 1) * localBpPerUnit,
          span: globalBins[idx].e - globalBins[idx].s,
          skip_index: [],
          skip_count: 0,
          visible: true,
          padding: 0.1 * (k + 1),
          modelMatrix
        };
      }

    } else {
      // Store as merged group

      const centerX = 0;
      const scaleX = scaleFactor;
      // const scaleX = 5;
      const divide_pos = groupStart / globalBpPerUnit;

      const modelMatrix = new Matrix4()
      .translate([divide_pos, 0, 0])    // move to world coordinate
      .translate([centerX, 0, 0])       // shift origin to local center
      .scale([scaleX, 1, 1])            // shrink only in X
      .translate([-centerX, 0, 0]);     // shift back

      sampled_trees[j] = {
        index: j,
        global_index: j,
        position: groupStart,
        span: span_total,
        skip_index: [...skip_index],
        skip_count: skip_index.length,
        visible: true,
        padding: 0,
        modelMatrix
      };
    }
  }

  return sampled_trees;
}


function modified_sampleTrees(globalBins, lo, hi, globalBpPerUnit, nTrees) {
  let sampled_trees = {};
  let i = lo;

  let moving = false;
  
  if (nTrees <= 2) {
    moving = true;
  }
  // there are two things I want to do here.
  // 1. acccess the regions to show the trees that fit within the region. 

  while (i <= hi) {
    const startBin = globalBins[i];
    let groupStart = startBin.s;
    let groupEnd = startBin.e;

    const skip_index = [];
    let j = i; // index of the representative bin
    i++;

    // Keep merging bins as long as the group span ≤ globalBpPerUnit
    while (i <= hi ) {
      const nextBin = globalBins[i];
      const span = nextBin.s - groupStart;

      if (span > globalBpPerUnit) break;
      groupEnd = nextBin.e;
      skip_index.push(i);
      i++;
    }


    sampled_trees[j] = {
      index: j,
      global_index: j,
      position: groupStart,
      span: groupEnd - groupStart,
      skip_index,
      skip_count: skip_index.length,
      position: groupStart,
      visible: true,
      padding: 0
    };
        // check if the span is greater then skip_count*globalBpPerUnit
        let span_total = groupEnd - groupStart;
        if (span_total > (skip_index.length+1)*globalBpPerUnit) {
          for (let k = 0; k < skip_index.length; k++) {
            sampled_trees[skip_index[k]] = {
              index: skip_index[k],
              global_index: skip_index[k],
              position: groupStart+(k+1)*globalBpPerUnit,
              span: globalBins[skip_index[k]].e - globalBins[skip_index[k]].s,
              skip_index: [],
              skip_count: 0,
              visible: true,
              padding: 0.1 * (k+1)
            };
            delete sampled_trees[j].skip_index[k]
            sampled_trees[j].skip_count--;
            sampled_trees[j].span = globalBins[j].e - globalBins[j].s;
         
          }
        }
  }
  return sampled_trees;
}

function upperBound(keys, x) {
  let lo = 0, hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function new_makeGetLocalData(){
  let lastStart = null;
  let lastEnd = null;
  let localBins = {};
  let globalbufferStart = null;
  let globalbufferEnd = null;

  return async function getLocalData(
    start, 
    end, 
    globalBins,
    config_intervals,
    queryNodes,
    globalBpPerUnit,
    nTrees,
    new_globalBp
  ) {
    const buffer = 0.1;
    const bufferStart = Math.max(0, start - start * buffer);
    const bufferEnd = Math.min(globalBins.length - 1, end + end * buffer);
    const intervalKeys = Object.keys(config_intervals.new_intervals);

    const lower_bound = lowerBound(intervalKeys, bufferStart);
    const upper_bound = upperBound(intervalKeys, bufferEnd);

    const addBins = (lo, hi) => {

      for (let i = lo; i <= hi; i++) {
        const temp_bin = globalBins[i];

        localBins[i] = {
          ...temp_bin,
          path: null,
          global_index: i,
        };
      }
    };

    if (
      lastStart == null ||
      lastEnd == null ||
      upper_bound < lastStart ||
      lower_bound > lastEnd
    ) {
      localBins = {};
      addBins(lower_bound, upper_bound);

    } else {
      // shrink left
      if (lower_bound > lastStart) {
        for (let i = lastStart; i < lower_bound; i++) {
          delete localBins[i];
        }
      }

      // expand left
      if (lower_bound < lastStart) {
        addBins(lower_bound, lastStart - 1);
      }

      // expand right
      if (upper_bound > lastEnd) {
        addBins(lastEnd + 1, upper_bound);
      }

      // shrink right
      if (upper_bound < lastEnd) {
        for (let i = lastEnd; i > upper_bound; i--) {
          delete localBins[i];
        }
      }
    }

    let {temp_bins, rangeArray} = complete_new_sampling(localBins, globalBpPerUnit, nTrees, new_globalBp);
    // console.log("temp_bins", temp_bins, rangeArray);

     // batch query once for all new bins
     if (rangeArray.length > 0) {
      const results = await queryNodes([], rangeArray);
      rangeArray.forEach(({ global_index }) => {
        localBins[global_index].path =
          results.paths[global_index] || null;
      });
    }

    lastStart = lower_bound;
    lastEnd = upper_bound;
    return { ...temp_bins };

  }
}
function makeGetLocalData() {
  let lastStart = null;
  let lastEnd = null;
  let localBins = {};
  let globalbufferStart = null;
  let globalbufferEnd = null;

  return async function getLocalData(
    start,
    end,
    globalBins,
    config_intervals,
    queryNodes,
    globalBpPerUnit,
    nTrees,
    new_globalBp
  ) {
    const buffer = 0.1;
    const bufferStart = Math.max(0, start - start * buffer);
    const bufferEnd = Math.min(globalBins.length - 1, end + end * buffer);
    const intervalKeys = Object.keys(config_intervals.new_intervals);

    const lower_bound = lowerBound(intervalKeys, bufferStart);
    const upper_bound = upperBound(intervalKeys, bufferEnd);
    // const sampledTrees = modified_sampleTrees(globalBins, lower_bound, upper_bound, globalBpPerUnit, nTrees);
    const sampledTrees = new_modified_sampleTrees(globalBins, lower_bound, upper_bound, globalBpPerUnit, nTrees, new_globalBp);
    // console.log("sampledTrees", sampledTrees);

    if (globalbufferStart == null || globalbufferEnd == null) {
      globalbufferStart = bufferStart;
      globalbufferEnd = bufferEnd;
    } else {
      if(globalbufferStart < start && globalbufferEnd > end) {
        // TODO adjust sampled trees based on zoom. 
        // For every sampledTree, update the modelMatrix in localBins if it exists
        Object.keys(localBins).forEach((key) => {
          if (sampledTrees[key]) {
            // Replace the bin object to ensure React/deck.gl see a new reference
            localBins[key] = {
              ...localBins[key],
              ...sampledTrees[key],
            };
          } else{
            localBins[key] = {
              ...localBins[key],
              visible: false,
            }
          }
        });
        return { ...localBins };
      }
      else {
        globalbufferStart = bufferStart;
        globalbufferEnd = bufferEnd;
      }
    }
    // collect all new bins to query in one pass
    const rangeArray = [];

    const addBins = (lo, hi) => {

      for (let i = lo; i <= hi; i++) {
        const temp_bin = globalBins[i];
        const visible = sampledTrees[i] ? true : false;

        localBins[i] = {
          ...temp_bin,
          visible,
          path: null,
          global_index: i,
          skip_index: sampledTrees[i]?.skip_index,
          skip_count: sampledTrees[i]?.skip_count,
          span: sampledTrees[i]?.span,
          position: sampledTrees[i]?.position,
          padding: sampledTrees[i]?.padding,
          modelMatrix: sampledTrees[i]?.modelMatrix,
        };

        if (visible) {
          rangeArray.push({ global_index: i });
          sampledTrees[i].visible = false;
        }
      }
    };

    // CASE 1: no overlap, reset everything
    if (
      lastStart == null ||
      lastEnd == null ||
      upper_bound < lastStart ||
      lower_bound > lastEnd
    ) {
      localBins = {};
      addBins(lower_bound, upper_bound);

    } else {
      // shrink left
      if (lower_bound > lastStart) {
        for (let i = lastStart; i < lower_bound; i++) {
          delete localBins[i];
        }
      }

      // expand left
      if (lower_bound < lastStart) {
        addBins(lower_bound, lastStart - 1);
      }

      // expand right
      if (upper_bound > lastEnd) {
        addBins(lastEnd + 1, upper_bound);
      }

      // shrink right
      if (upper_bound < lastEnd) {
        for (let i = lastEnd; i > upper_bound; i--) {
          delete localBins[i];
        }
      }
    }
    
    // batch query once for all new bins
    if (rangeArray.length > 0) {
      const results = await queryNodes([], rangeArray);
      rangeArray.forEach(({ global_index }) => {
        localBins[global_index].path =
          results.paths[global_index] || null;
      });
    }

    lastStart = lower_bound;
    lastEnd = upper_bound;
    return { ...localBins };
  };
}

const getLocalData = makeGetLocalData();

const new_getLocalData = new_makeGetLocalData();

function getDynamicBpPerUnit(globalBpPerUnit, zoom, baseZoom = 8) {

  const zoomDiff = zoom - baseZoom;
  const scaleFactor = Math.max(1, Math.pow(2, -zoomDiff));
  const new_globalBpPerUnit = globalBpPerUnit * Math.floor(scaleFactor);
  return new_globalBpPerUnit;
}

// ---------- hook ----------
const useRegions = ({ backend, globalBins, valueRef, viewState, saveViewports, globalBpPerUnit, tsconfig }) => {
  const { queryNodes } = backend;

  const [localBins, setLocalBins] = useState({});
  const scaleFactorRef = useRef(1);

  const debouncedQuery = useMemo(
    () =>
      debounce((val) => {
        const [lo, hi] = val;
        if (!globalBins) return;

        const zoom = viewState["ortho"]?.zoom?.[0];
        const width = saveViewports["ortho"]?.width;
        const nTrees = (width / Math.pow(2, zoom));
        
        let new_globalBp = getDynamicBpPerUnit(globalBpPerUnit, zoom);

        // scaleFactorRef.current = new_globalBp / globalBpPerUnit;
        scaleFactorRef.current = 1;

        // compute and set bins directly
        // getLocalData(lo, hi, globalBins, tsconfig, queryNodes, globalBpPerUnit, nTrees, new_globalBp ).then(
        //   (bins) => {
        //     // Always set a new object so React detects changes even if key count is the same
        //     setLocalBins(bins);
        //   });

          new_getLocalData(lo, hi, globalBins, tsconfig, queryNodes, globalBpPerUnit, nTrees, new_globalBp ).then((bins) => {
            console.log("bins", bins);
            setLocalBins({...bins});
          });
      }, 100),
    [queryNodes, globalBins, viewState]
  );

  useEffect(() => {
    if (globalBins && valueRef.current) {
      debouncedQuery(valueRef.current);
    }
  }, [globalBins, valueRef.current, debouncedQuery]);

  useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);

  const localCoordinates = useMemo(() => {
    if (!valueRef.current) return [];
    const [lo, hi] = valueRef.current;
    const bufferFrac = 0.2;
    const range = hi - lo;
    return getLocalCoordinates(lo - bufferFrac * range, hi + bufferFrac * range);
  }, [valueRef.current?.[0], valueRef.current?.[1]]);

  const local_bins = useMemo(() => {
    return localBins;
  }, [localBins]);

  return useMemo(
    () => ({
      bins: local_bins,
      localCoordinates,
      scaleFactor: scaleFactorRef.current,
    }),
    [localBins, localCoordinates, scaleFactorRef.current]
  );
};

export default useRegions;
