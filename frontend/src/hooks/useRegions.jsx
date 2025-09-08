import { useMemo } from "react";

function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

function upperBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= x) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

function logNormalize(arr, targetTotal) {
  // log10(x+1) to compress range; shift positive; scale to targetTotal
  const n = arr.length;
  if (n === 0) return [];
  const shifted = new Array(n);
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, arr[i]); // guard negatives
    const s = Math.log10(v + 1);
    shifted[i] = s;
    if (s < min) min = s;
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    shifted[i] -= min;
    sum += shifted[i];
  }
  if (sum === 0) {
    const equal = targetTotal / n;
    return new Array(n).fill(equal);
  }
  const scale = targetTotal / sum;
  for (let i = 0; i < n; i++) shifted[i] *= scale;
  return shifted;
}



const useRegions = ({ config, viewportSize }) => {
  // Compute bins only when config changes (viewportSize not used)
  const bins = useMemo(() => {
    if (!config || !config.value || !config.new_intervals) return [];

    const intervals = config.new_intervals; // { key:numberLike: [start,end], ... }
    
    let [start, end] = config.value;
    if (start > end) [start, end] = [end, start];

    start = 0
    // Use the last key (as number) to get the last interval's end
    const lastKey = Object.keys(intervals)[Object.keys(intervals).length - 1];
    end = intervals[lastKey][1];

    // sort numeric keys once
    const keys = Object.keys(intervals).map(Number).sort((a, b) => a - b);
    if (keys.length === 0) return [];

    // slice keys into [start,end] via binary search
    const lo = lowerBound(keys, start);
    const hi = upperBound(keys, end);
    if (lo > hi) return [];

    const inRange = keys.slice(lo, hi + 1);

    // Leading degenerate interval at the very first start (keeps lengths aligned with weights)
    const firstStart = intervals[inRange[0]][0];
    const list = new Array(inRange.length + 1);
    list[0] = [firstStart, firstStart];
    for (let i = 0; i < inRange.length; i++) {
      const k = inRange[i];
      list[i + 1] = intervals[k];
    }

    // Interval widths (prefix 0 to match original logic)
    const widths = new Array(list.length);
    widths[0] = 0;
    for (let i = 0; i < inRange.length; i++) {
      const [s, e] = intervals[inRange[i]];
      widths[i + 1] = Math.max(0, e - s);
    }

    // Keep the accumulated total consistent with original code:
    // targetTotal == number of (real) intervals
    const targetTotal = inRange.length;
    const weights = logNormalize(widths, targetTotal);

    // Build bins with cumulative positions
    const out = new Array(list.length);
    let acc = 0;
    for (let i = 0; i < list.length; i++) {
      acc += weights[i];
      const [s, e] = list[i];
      out[i] = {
        start: s,
        end: e,
        sourcePosition: [acc, 0],
        targetPosition: [acc, 2],
      };
    }

    return out;
    
  }, [config?.value, config?.new_intervals]);

  // Keep your old API if you were calling a function.
  const getbounds = useMemo(() => () => bins, [bins]);

  

  return { bins, getbounds };
};

export default useRegions;


// i'm here first getting the start and end from from thec config.value and 
// then logNormalizing the intervalst and creating the bins withing the range of number of intervals. 
// then the trees are rendered 0 to 1. 
// so, if the value changes, the bins should be recreated. 
// now the start and are always 0 and the end is the last interval's end. 
// what I want is global bins, local bins that is sliced based on the config.value. , and then the trees are rendered 0 to 1. 