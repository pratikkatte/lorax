// import { useMemo, useEffect, useState, useRef } from "react";
// import debounce from "lodash.debounce";
// import memoizeOne from "memoize-one";
// import { Matrix4 } from "@math.gl/core";

// function niceStep(step) {
//   const exp = Math.floor(Math.log10(step));
//   const base = Math.pow(10, exp);
//   const multiples = [1, 2, 5, 10];
//   for (let m of multiples) if (step <= m * base) return m * base;
//   return multiples[multiples.length - 1] * base;
// }

// const getLocalCoordinates = memoizeOne((lo, hi) => {
//   const range = hi - lo;
//   const divisions = range > 1000 ? 5 : 10;
//   const rawStep = range / divisions;
//   const stepSize = niceStep(rawStep);

//   const start = Math.ceil(lo / stepSize) * stepSize;
//   const end   = Math.floor(hi / stepSize) * stepSize;
//   const n = Math.floor((end - start) / stepSize) + 1;

//   return Array.from({ length: n }, (_, i) => {
//     const x = start + i * stepSize;
//     return { x, y: 0, text: x };
//   });
// });

// function lowerBound(arr, x) {
//   let lo = 0, hi = arr.length - 1, ans = arr.length;
//   while (lo <= hi) {
//     const mid = (lo + hi) >> 1;
//     if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
//   }
//   return ans;
// }

// function distribute(total, spans, alpha = 0.5) {
//   const n = spans.length;
//   const spacing = 0.05
//   const S = spans.reduce((a, b) => a + b, 0);
//   return spans.map(s => (total *(alpha * (1 / n) + (1 - alpha) * (s / S))) - spacing
//   );
// }

// function complete_new_sampling(localBins, globalBpPerUnit, nTrees, new_globalBp) {


//   const rangeArray = [];


//   let prevBinEndIdx = null;
//   let globalBin = null;

//   let skipCount = 0;
//   let binStart = 0;
//   let binEnd = 0;

//   let scaleFactor = new_globalBp / globalBpPerUnit;
  

//   let func_globalBpPerUnit = new_globalBp;
//   const finalizeBin = () => {

//     if (!globalBin) return;

//     let bin_indexes = globalBin.skip_idx;

//     if (bin_indexes.length == 1) {
//       let global_index = bin_indexes[0];

//       let span = localBins[global_index].e - localBins[global_index].s;
//       // localBins[global_index].visible = true;
//       localBins[global_index]?.path == null && rangeArray.push({ global_index: parseInt(global_index) });
//       const centerX = 0;
//       const scaleX = span/(globalBpPerUnit*1.05);
//       const dividePos = localBins[global_index].s / globalBpPerUnit;

//       const modelMatrix = new Matrix4()
//       .translate([dividePos, 0, 0])
//       .translate([centerX, 0, 0])
//       .scale([scaleX, 1, 1])
//       .translate([-centerX, 0, 0]);

//       localBins[global_index] = {
//         ...localBins[global_index],
//         bin_start: binStart,
//         visible: true,
//         span: globalBin.span,
//         modelMatrix,
//         position: localBins[global_index].s,
//       };
//       return;
//     } 
//     else {
//         // multi-bin case
//         const maxSpan = Math.max(...globalBin.index_span);
//         const maxIndex = bin_indexes[globalBin.index_span.indexOf(maxSpan)];

//       if (scaleFactor == 1) {

//         let temp_span = globalBin.span;
//         let temp_position = binStart;
//         let temp_bin_start = binStart;

//         let dist_scales = distribute(temp_span/globalBpPerUnit, globalBin.index_span, 0.5);
//         const tmpMatrix = new Matrix4();
        
//         bin_indexes.forEach((idx, i) => {

//           const dividePos = temp_position / globalBpPerUnit;
//           localBins[idx]?.path == null && rangeArray.push({ global_index: parseInt(idx) });

//           tmpMatrix.identity()
//           .translate([dividePos, 0, 0])
//           .scale([dist_scales[i], 1, 1]);
//           const modelMatrix = tmpMatrix.clone();

//           localBins[idx] = {
//             ...localBins[idx],
//             span: temp_span,
//             bin_start: temp_bin_start,
//             position: temp_position,
//             visible: true,
//             modelMatrix: modelMatrix,
//           };
//           temp_position += dist_scales[i]*globalBpPerUnit*1.05;
//         })
//       }
//       else{
        
//         const tmpMatrix = new Matrix4();
//       bin_indexes.forEach((idx) => {

//         if (idx == maxIndex) {

//           let temp_span = globalBin.span;
//           let temp_bin_start = binStart;
//           let temp_position = binStart;

//           // let scaleX = (localBins[idx].e - localBins[idx].s)/(globalBpPerUnit*1.05);
//           // let scaleX = 0.6;
//           let scaleX = temp_span/(globalBpPerUnit*1.05);
//           const dividePos = temp_position / globalBpPerUnit;

//           localBins[idx]?.path == null && rangeArray.push({ global_index: parseInt(idx) });

//           tmpMatrix.identity()
//           .translate([dividePos, 0, 0])
//           .scale([scaleX, 1, 1]);
//           const modelMatrix = tmpMatrix.clone();

//         // const modelMatrix = new Matrix4()
//         // .translate([dividePos, 0, 0])
//         //   .translate([centerX, 0, 0])
//         //   .scale([scaleX, 1, 1])
//         //   .translate([-centerX, 0, 0])
          
//           localBins[idx] = {
//             ...localBins[idx],
//             span: temp_span,
//             bin_start: temp_bin_start,
//             position: temp_position,
//             visible: true,
//             modelMatrix: modelMatrix,
//           };
//         } else{

//           localBins[idx].visible = false;
//           localBins[idx].span = null;
//           localBins[idx].bin_start = null;
//           localBins[idx].position = null;
//           localBins[idx].modelMatrix = null;
//         }
//       });
//     }
//     }
//   };

  
//   for (const key in localBins) {
//     if (!Object.prototype.hasOwnProperty.call(localBins, key)) continue;

//     const s = localBins[key].s;
//     const e = localBins[key].e;
//     const span = e - s;
//     const binIdxStart = Math.floor(s / globalBpPerUnit);
//     const binIdxEnd = Math.floor(e / globalBpPerUnit);

//     if (prevBinEndIdx === null) {
//       // first bin
//       globalBin = { skip: 0, skip_idx: [key], span, index_span: [span] };
//       binStart = s;
//       binEnd = e;
//     } else if (binIdxEnd == prevBinEndIdx || globalBin.span < func_globalBpPerUnit) {
//       // merge with current global bin
//       skipCount++;
//       globalBin.skip_idx.push(key);
//       globalBin.index_span.push(span)
//       // localBins[key].visible = false;
//       // localBins[key].span = span;
//       binEnd = e;
//       globalBin.span = binEnd - binStart;
//     } else {
//       // close out current bin and start a new one
//       finalizeBin();
//       skipCount = 0;
//       globalBin = { skip: 0, skip_idx: [key], span, index_span: [span] };
//       binStart = s;
//       binEnd = e;
//     }

//     prevBinEndIdx = binIdxEnd;
//   }

//   // finalize last one
//   finalizeBin();

//   return { rangeArray };
// }

// function upperBound(keys, x) {
//   let lo = 0, hi = keys.length;
//   while (lo < hi) {
//     const mid = (lo + hi) >> 1;
//     if (keys[mid] <= x) lo = mid + 1;
//     else hi = mid;
//   }
//   return lo;
// }

// function new_makeGetLocalData(){
//   let lastStart = null;
//   let lastEnd = null;
//   // let localBins = {};

//   return async function getLocalData(
//     start, 
//     end, 
//     localBins,
//     config_intervals,
//     globalBpPerUnit,
//     nTrees,
//     new_globalBp
//   ) {
//     console.log("localBins", localBins);
//     const buffer = 0.1;
//     const bufferStart = Math.max(0, start - start * buffer);
//     // const bufferEnd = Math.min(globalBins.length - 1, end + end * buffer);
//     const intervalKeys = Object.keys(config_intervals.new_intervals);
//     const bufferEnd = Math.min(intervalKeys.length - 1, end + end * buffer);

//     const lower_bound = lowerBound(intervalKeys, bufferStart);
//     const upper_bound = upperBound(intervalKeys, bufferEnd);

//     const addBins = (lo, hi) => {

//       for (let i = lo; i <= hi; i++) {
//         const temp_bin = config_intervals.new_intervals[intervalKeys[i]];


//         localBins[i] = {
//           s: temp_bin[0],
//           e: temp_bin[1],
//           path: null,
//           global_index: i,
//         };
//       }
//     };

//     if (
//       lastStart == null ||
//       lastEnd == null ||
//       upper_bound < lastStart ||
//       lower_bound > lastEnd
//     ) {
//       localBins = {};
//       addBins(lower_bound, upper_bound);

//     } else {
//       // shrink left
//       if (lower_bound > lastStart) {
//         for (let i = lastStart; i < lower_bound; i++) {
//           delete localBins[i];
//         }
//       }

//       // expand left
//       if (lower_bound < lastStart) {
//         addBins(lower_bound, lastStart - 1);
//       }

//       // expand right
//       if (upper_bound > lastEnd) {
//         addBins(lastEnd + 1, upper_bound);
//       }

//       // shrink right
//       if (upper_bound < lastEnd) {
//         for (let i = lastEnd; i > upper_bound; i--) {
//           delete localBins[i];
//         }
//       }
//     }

//     let {rangeArray} = complete_new_sampling(localBins, globalBpPerUnit, nTrees, new_globalBp);
//     // let {temp_bins, rangeArray} = new_complete_new_sampling(localBins, globalBpPerUnit, nTrees, new_globalBp);

//      // batch query once for all new bins
    
//     lastStart = lower_bound;
//     lastEnd = upper_bound;
//     return {local_bins: localBins, rangeArray };
//   }
// }

// const new_getLocalData = new_makeGetLocalData();

// function getDynamicBpPerUnit(globalBpPerUnit, zoom, baseZoom = 8) {

//   const zoomDiff = zoom - baseZoom;
//   const scaleFactor = Math.max(1, Math.pow(2, -zoomDiff));
//   const new_globalBpPerUnit = globalBpPerUnit * Math.floor(scaleFactor);
//   return new_globalBpPerUnit;
// }

// const useRegions = ({ backend, globalBins, valueRef, viewState, saveViewports, globalBpPerUnit, tsconfig }) => {
//   const { queryNodes } = backend;

//   // const localBinsRef = useRef({});
//   const [localBins, setLocalBins] = useState({});
//   const isPullingData = useRef(false);

//   const debouncedQuery = useMemo(
//     () =>
//       debounce((val) => {
//         const [lo, hi] = val;
//         if (!globalBins) return;

//         const zoom = viewState["ortho"]?.zoom?.[0];
        
//         let new_globalBp = getDynamicBpPerUnit(globalBpPerUnit, zoom);
//           new_getLocalData(lo, hi, localBins, tsconfig, globalBpPerUnit, null, new_globalBp ).then(({local_bins, rangeArray}) => {

//             if(isPullingData.current) return;

//             isPullingData.current = true;

//             console.log("rangeArray", rangeArray, local_bins);
//             if (rangeArray.length > 0) {
//               queryNodes([], rangeArray).then((results) => {
//               rangeArray.forEach(({ global_index }) => {
//                 local_bins[global_index].path =
//                   results.paths[global_index] || null;
//               });
//               });
//             }

//             isPullingData.current = false;
//             setLocalBins({...local_bins});
//           });
//       }, 500),
//     [queryNodes, globalBins, viewState]
//   );

//   useEffect(() => {
//     if (globalBins && valueRef.current) {
//       debouncedQuery(valueRef.current);
//     }
//   }, [globalBins, valueRef.current, debouncedQuery]);

//   useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);

//   const localCoordinates = useMemo(() => {
//     if (!valueRef.current) return [];
//     const [lo, hi] = valueRef.current;
//     const bufferFrac = 0.2;
//     const range = hi - lo;
//     return getLocalCoordinates(lo - bufferFrac * range, hi + bufferFrac * range);
//   }, [valueRef.current?.[0], valueRef.current?.[1]]);

//   return useMemo(
//     () => ({
//       bins: localBins,
//       localCoordinates,
//     }),
//     [localBins, localCoordinates]
//   );
// };

// export default useRegions;


import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import debounce from "lodash.debounce";
import memoizeOne from "memoize-one";
import { Matrix4 } from "@math.gl/core";

// ────────────────────────────────
// Utility functions
// ────────────────────────────────

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
  const end = Math.floor(hi / stepSize) * stepSize;
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

function upperBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function distribute(total, spans, alpha = 0.5) {
  const n = spans.length;
  const spacing = 0.05;
  const S = spans.reduce((a, b) => a + b, 0);
  return spans.map(s => total * (alpha * (1 / n) + (1 - alpha) * (s / S)) - spacing);
}

// ────────────────────────────────
// Bin sampling
// ────────────────────────────────

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

// ────────────────────────────────
// new_makeGetLocalData (fixed)
// ────────────────────────────────

function new_makeGetLocalData() {
  let lastStart = null;
  let lastEnd = null;

  return async function getLocalData(
    start, end, localBins, config_intervals, globalBpPerUnit, nTrees, new_globalBp
  ) {
    const bins = { ...localBins }; // safe copy
    const buffer = 0.1;
    const bufferStart = Math.max(0, start - start * buffer);
    const intervalKeys = Object.keys(config_intervals.new_intervals)
      .map(Number)
      .sort((a, b) => a - b);
    if (intervalKeys.length === 0) return { local_bins: {}, rangeArray: [] };

    const bufferEnd = Math.min(intervalKeys.length - 1, end + end * buffer);
    const lower_bound = lowerBound(intervalKeys, bufferStart);
    const upper_bound = upperBound(intervalKeys, bufferEnd);

    const addBins = (lo, hi) => {
      for (let i = lo; i <= hi; i++) {
        const temp_bin = config_intervals.new_intervals[intervalKeys[i]];
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
    lastStart = lower_bound;
    lastEnd = upper_bound;
    return { local_bins: bins, rangeArray };
  };
}

// ────────────────────────────────
// getDynamicBpPerUnit
// ────────────────────────────────

function getDynamicBpPerUnit(globalBpPerUnit, zoom, baseZoom = 8) {
  const zoomDiff = zoom - baseZoom;
  const scaleFactor = Math.max(1, Math.pow(2, -zoomDiff));
  return globalBpPerUnit * Math.floor(scaleFactor);
}

// ────────────────────────────────
// useRegions Hook
// ────────────────────────────────

const useRegions = ({ backend, globalBins, valueRef, viewState, globalBpPerUnit, tsconfig }) => {
  const { queryNodes } = backend;
  const [localBins, setLocalBins] = useState({});
  const localBinsRef = useRef(localBins);
  const isFetching = useRef(false);
  const getLocalData = useMemo(() => new_makeGetLocalData(), []);

  // keep latest localBins for stable debounced callback
  useEffect(() => { localBinsRef.current = localBins; }, [localBins]);

  const debouncedQuery = useMemo(
    () => debounce(async (val) => {
      if (!globalBins || isFetching.current) return;
      const [lo, hi] = val;
      const zoom = viewState["ortho"]?.zoom?.[0] ?? 8;
      const new_globalBp = getDynamicBpPerUnit(globalBpPerUnit, zoom);

      isFetching.current = true;
      const { local_bins, rangeArray } = await getLocalData(
        lo, hi, localBinsRef.current, tsconfig, globalBpPerUnit, null, new_globalBp
      );

      if (rangeArray.length > 0) {
        const results = await queryNodes([], rangeArray);
        rangeArray.forEach(({ global_index }) => {
          local_bins[global_index].path = results.paths[global_index] || null;
        });
      }

      setLocalBins({ ...local_bins });
      isFetching.current = false;
    }, 400, { leading: false, trailing: true }),
    [queryNodes, globalBins, viewState, getLocalData]
  );

  useEffect(() => {
    if (globalBins && valueRef.current) debouncedQuery(valueRef.current);
  }, [globalBins, valueRef.current, debouncedQuery]);

  useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);

  const localCoordinates = useMemo(() => {
    if (!valueRef.current) return [];
    const [lo, hi] = valueRef.current;
    const bufferFrac = 0.2;
    const range = hi - lo;
    return getLocalCoordinates(lo - bufferFrac * range, hi + bufferFrac * range);
  }, [valueRef.current?.[0], valueRef.current?.[1]]);

  return useMemo(() => ({
    bins: localBins,
    localCoordinates,
  }), [localBins, localCoordinates]);
};

export default useRegions;

