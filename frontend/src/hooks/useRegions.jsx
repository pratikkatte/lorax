import { useMemo, useRef, useEffect, useState } from "react";

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

const useRegions = ({ config, globalBins, setView, viewPortCoords, value, globalBinsIndexes, setGlobalBinsIndexes, dataExtractValues, setDataExtractValues, backend}) => {

  const { queryLocalBins } = backend;


  const [localBins, setLocalBins] = useState(null);

  const isValueRef = useRef(null);

  const localBinsRef = useRef(null);

  const bufferRef = useRef(null);



  useEffect(() => {

    if (globalBins && value, globalBinsIndexes) {
      if(localBins) {
      queryLocalBins(localBins.data.local_bins, globalBinsIndexes, setLocalBins);
      } else {
        queryLocalBins(null, globalBinsIndexes, setLocalBins);
      }
    }

  }, [globalBins, value]);

  useEffect(() => {
    
  }, [localBins]);


  const {bins, maxX, minX} = useMemo(() => {

    if (globalBins, localBins) {
      const [lo, hi] = globalBinsIndexes;

      const hiBuffered = localBins.data.hiBuffered;
      const loBuffered = localBins.data.loBuffered;
      const local_bins = localBins.data.local_bins;
      const maxX = localBins.data.maxX;
      const minX = localBins.data.minX;

      if(bufferRef.current && (lo < bufferRef.current.index[0] || hi > bufferRef.current.index[1])) {

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
      
      return {bins: local_bins, maxX: maxX, minX: minX};
    }

    return {bins: [], maxX: 0, minX: 0};

  }, [localBins]);

  const lastAppliedView = useRef({ zoom: null, target: null });

  useEffect(() => {
    if (!bufferRef.current) return;

    const [loBuffered, hiBuffered] = bufferRef.current.value;

    setDataExtractValues([loBuffered, hiBuffered]);
  }, [bufferRef.current]);

  const getbounds = useMemo(() => () => bins, [bins]);

  return { bins, getbounds };
};

export default useRegions;
