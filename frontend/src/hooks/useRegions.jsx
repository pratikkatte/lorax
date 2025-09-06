import { useCallback, useEffect, useState, useMemo } from "react";

const useRegions = ({config, viewportSize}) => {

  function findKeysInRange(intervals, start, end) {
    return Object.keys(intervals)
      .map(Number) // convert keys from string to number
      .filter(key => key >= start && key <= end);
  }

  // function logNormalize(arr, eps = 1e-3) {
  //   const shifted = arr.map(x => Math.log10(x + 1));      // compress range
  //   const min = Math.min(...shifted);
  //   const max = Math.max(...shifted);
  
  //   // Handle constant arrays
  //   if (!isFinite(min) || !isFinite(max) || Math.abs(max - min) < 1e-12) {
  //     return arr.map(() => 0.5); // everything to midpoint
  //   }
  
  //   const scale = (1 - 2 * eps) / (max - min);
  //   return shifted.map(v => eps + (v - min) * scale);
  // }

  function logNormalize(arr, nbins) {
    // 1. Apply log transform to compress dynamic range
    const shifted = arr.map(x => Math.log10(x + 1));
  
    // 2. Shift to positive
    const min = Math.min(...shifted);
    const positive = shifted.map(v => v - min);
  
    // 3. Normalize so they sum to 1
    const total = positive.reduce((a, b) => a + b, 0);
    if (total === 0) {
      // edge case: all equal
      return arr.map(() => nbins / arr.length);
    }
  
    const probs = positive.map(v => v / total);
  
    // 4. Scale so the sum is nbins
    return probs.map(p => p * nbins);
  }
  
  // // Example:
  // const data = [82571, 130, 53, 21, 123, 163, 191, 206, 153, 18, 163, 137];
  // const out = logNormalizeSumBins(data, 12);
  // console.log(out, "sum =", out.reduce((a,b) => a+b, 0));
  

  

    const makeUniformedBins = useCallback(() => {
        
        var intervals = config.new_intervals; 
        
        var window_size = config.value[1] - config.value[0];
       
       // bpPerbins

        const filtered_intervals = findKeysInRange(intervals, config.value[0], config.value[1])

        var bpPerbins = window_size / filtered_intervals.length

        var nbins = window_size / bpPerbins


        var distance_between_intervals = filtered_intervals.map(key => intervals[key][1] - intervals[key][0])
        distance_between_intervals = [0, ...distance_between_intervals]
        const log_normalized = logNormalize(distance_between_intervals, nbins)

        
        const list_of_intervals = [[intervals[filtered_intervals[0]][0],intervals[filtered_intervals[0]][0]],...filtered_intervals.map(key => intervals[key])]

        let bins = []
        let prev_sourcePosition = 0

        for (let i = 0; i < log_normalized.length; i++) {
          let sourcePosition = prev_sourcePosition + log_normalized[i]
          prev_sourcePosition = sourcePosition

          
          bins.push({
            start: list_of_intervals[i][0],
            end: list_of_intervals[i][1],
            sourcePosition: [sourcePosition, 0],
            targetPosition: [sourcePosition, 2]
          })
        }

        return bins

    }, [config, viewportSize])
    // const makeFixedBins = useCallback((
    //     genome_length,
    //     viewport_width,
    //     start = 0,
    //     end = null,
    //     zoom = 8,
    //     baseZoom = 8,
    //     baseBinBP = 10000,
    //     baseNbins = 5
    //   ) => {
    //     const bins = [];
    //     // const regionEnd = end ?? genome_length;
  
    //     window_size = end-start;

    //     let bpPerbin = window_size / baseNbins;


    //     const scale = Math.pow(2, baseZoom - Math.ceil(zoom));
  
    //     const desiredBinBP = baseBinBP * scale;
  
    //     // const L = Math.max(0, regionEnd - start);
  
    //   //   const binBP = alignedBinBP(L, desiredBinBP, "ceil");
    //     const binBP = desiredBinBP;
  
    //     const regionEnd = (end ?? genome_length)+binBP;
    //     // global index offset
    //     let i = Math.floor(start / binBP);
  
    //     for (let pos = start; pos <= regionEnd; pos += binBP, i++) {
    //       const binStart = pos;
  
    //       // const binEnd = Math.min(pos + binBP, regionEnd);
    //       const binEnd = pos + binBP;
  
    //       bins.push({
    //         start: binStart,
    //         end: binEnd,
    //         i, // global bin index
    //         sourcePosition: [i, 0],
    //         targetPosition: [i, 2]
    //       });
    //     }
  
    //     return {bins, binBP};
    //   }, config]);

  const getbounds = useMemo(() => {
    return () => {
      if (!config || !viewportSize) return [];
      const genome_window_size = config.value[1] - config.value[0];
      const viewport_width = viewportSize[0];
      const bins = makeUniformedBins()
      return bins
    };
  }, [config, viewportSize]);

  return useMemo(() => {
    return {
      getbounds
    }
  }, [getbounds]);
}

export default useRegions;