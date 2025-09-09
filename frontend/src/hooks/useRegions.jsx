import { useMemo, useRef, useEffect} from "react";

function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

// Extract the sorted x-array once
function getXArray(globalBins) {
  return globalBins.map(b => b.sourcePosition[0]);
}

function upperBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= x) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}

// Nearest index to x in a sorted array
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

const useRegions = ({ config, globalBins, setView, viewPortCoords, value, globalBinsIndexes, setGlobalBinsIndexes, dataExtractValues, setDataExtractValues}) => {

  const isValueRef = useRef(null);

  const localBinsRef = useRef(null);

  const bufferRef = useRef(null);

  const {bins, maxX, minX} = useMemo(() => {
    console.log("globalBinsIndexes", globalBinsIndexes)
    if (!config || !config.new_intervals || !globalBins || !value || !globalBinsIndexes) return [];

    const intervals = config.new_intervals; 

    let intervalsKeys = Object.keys(intervals);

    // slice keys into [start,end] via binary search
      let [lo, hi] = globalBinsIndexes;


    if (isValueRef.current === value) {
      console.log("value not changed", value, isValueRef.current)
      return {bins: localBinsRef.current.bins, maxX: localBinsRef.current.maxX, minX: localBinsRef.current.minX };
    }else if (isValueRef.current?.[0] === value[0]){
      lo = localBinsRef.current.lo;
    } else if (isValueRef.current?.[1] === value[1]){
      hi = localBinsRef.current.hi;
    }
    // lo = lo === null ? lowerBound(intervalsKeys, value[0]) : lo;

    // hi = hi === null ? upperBound(intervalsKeys, value[1]) : hi;

    if (lo > hi) return [];

    const nIntervals = hi - lo + 1;
    const buffer = nIntervals*2

    const loBuffered = Math.max(0, lo - buffer);
    const hiBuffered = Math.min(globalBins.length - 1, hi + buffer);

    let maxX = globalBins[hi+1].sourcePosition[0]
    let minX = globalBins[lo].sourcePosition[0]

    const local_bins = globalBins.slice(loBuffered, hiBuffered);

    if(bufferRef.current && (lo < bufferRef.current.index[0] || hi > bufferRef.current.index[1])){

      console.log("bufferRef.current local", local_bins[0].sourcePosition[0], local_bins[local_bins.length - 1].sourcePosition[0])
      bufferRef.current = {
        "index": [loBuffered, hiBuffered],
        "value": [local_bins[0].start, local_bins[local_bins.length - 1].end]
      };
    } 
    if (!bufferRef.current){
      bufferRef.current = {
        "index": [loBuffered, hiBuffered],
        "value": [local_bins[0].start, local_bins[local_bins.length - 1].end]
      };
    }
    
    if (local_bins.length === 0) return [];
    
    isValueRef.current = value;

    localBinsRef.current = {bins: local_bins, maxX, minX , lo, hi};

    // setDataExtractValues([loBuffered, hiBuffered]);

    return {bins: local_bins, maxX, minX};
    
  }, [config, globalBins, value, globalBinsIndexes]);

  const lastAppliedView = useRef({ zoom: null, target: null });

  useEffect(() => {
    if (!bufferRef.current) return;
    console.log("bufferRef.current", bufferRef.current)

    const [loBuffered, hiBuffered] = bufferRef.current.value;

    setDataExtractValues([loBuffered, hiBuffered]);
  }, [bufferRef.current]);


  // Function toset the view directly. 
  // useEffect(() => {

  //   const ortho_width = viewPortCoords ? viewPortCoords['ortho']?.viewport?.width : null;

  //   const span = maxX - minX;
    
  //   if (span <= 0) return;
  //   const target = minX + span / 2;
  //   const ortho_zoom = Math.log2(ortho_width / span);

  //   if (!Number.isFinite(ortho_zoom) || !Number.isFinite(target)) return;

  //   const eps = 1e-6;
  //   const { zoom: lastZ, target: lastT } = lastAppliedView.current;
  //   const sameZoom = lastZ !== null && Math.abs(lastZ - ortho_zoom) < eps;
  //   const sameTarget = lastT !== null && Math.abs(lastT - target) < eps;

  //   if (sameZoom && sameTarget) return;

  //   // setView({
  //   //   "genome-positions": { target, zoom: ortho_zoom },
  //   //   "ortho":            { target, zoom: ortho_zoom }
  //   // });

  //   lastAppliedView.current = { zoom: ortho_zoom, target };

  // }, [viewPortCoords])

  const getbounds = useMemo(() => () => bins, [bins]);

  return { bins, getbounds };
};

export default useRegions;
