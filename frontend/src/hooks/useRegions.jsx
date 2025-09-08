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

const useRegions = ({ config, globalBins }) => {
  // Compute bins only when config changes (viewportSize not used)

  // this all can inside webworker, when I receive config intervals. lol , so fast. :)

  const bins = useMemo(() => {
    if (!config || !config.value || !config.new_intervals || !globalBins) return [];

    const intervals = config.new_intervals; // { key:numberLike: [start,end], ... }

    let intervalsKeys = Object.keys(intervals);


    // slice keys into [start,end] via binary search
    const lo = lowerBound(intervalsKeys, config.value[0]);
    const hi = upperBound(intervalsKeys, config.value[1]);
    if (lo > hi) return [];

    // Add an exponential buffer (log2) to lo and hi+1
    // Compute the number of intervals in the current slice
    const nIntervals = hi - lo + 1;
    // Calculate buffer size: max(1, floor(log2(nIntervals)))
    const buffer = nIntervals*2
    // Adjust lo and hi with buffer, clamp to valid range
    const loBuffered = Math.max(0, lo - buffer);
    const hiBuffered = Math.min(globalBins.length - 1, hi + buffer);

    const local_bins = globalBins.slice(loBuffered, hiBuffered);
    return local_bins;
    
  }, [config?.value, config?.new_intervals]);

  // Keep your old API if you were calling a function.
  const getbounds = useMemo(() => () => bins, [bins]);

  

  return { bins, getbounds };
};

export default useRegions;
