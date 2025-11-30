
import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import debounce from "lodash.debounce";
import memoizeOne from "memoize-one";

// Utility functions
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

function getDynamicBpPerUnit(globalBpPerUnit, zoom, baseZoom = 8) {
  const zoomDiff = zoom - baseZoom;
  const scaleFactor = Math.max(1, Math.pow(2, -zoomDiff));
  return globalBpPerUnit * scaleFactor;
}

// useRegions Hook
const useRegions = ({ backend, valueRef, globalBpPerUnit, tsconfig, setStatusMessage, xzoom, yzoom, genomicValues }) => {
  const { queryNodes, queryLocalBins, getTreeData } = backend;

  const [localBins, setLocalBins] = useState(null);
  
  const isFetching = useRef(false);
  
  const regionWidth = useRef(null);

  // const [maxScale, setMaxScale] = useState(null);

  const [times, setTimes] = useState([]);


  const debouncedQuery = useMemo(
    () => debounce(async (val) => {
      if (isFetching.current) return;

      const [lo, hi] = val;
      // const zoom = viewState["ortho"]?.zoom?.[0] ?? 8;
      const zoom = xzoom ?? 8;

      const new_globalBp = getDynamicBpPerUnit(globalBpPerUnit, zoom);

      if (new_globalBp == globalBpPerUnit) {
        if (regionWidth.current == null) regionWidth.current = hi - lo;
      } else {
        regionWidth.current = null;
      }
      isFetching.current = true;

      const { local_bins, lower_bound, upper_bound, displayArray} = await queryLocalBins(
        lo, hi, globalBpPerUnit, null, new_globalBp, regionWidth.current
      );

      const rangeArray = [];
      for (const idx of displayArray){
        if (local_bins.has(idx)){

          const path = await getTreeData(idx, local_bins.get(idx).precision);
          if (!path) rangeArray.push({ global_index: idx });

          local_bins.set(idx, {
            ...local_bins.get(idx),
            path: path
          });
        }
      }
      setLocalBins(local_bins);

      if (rangeArray.length > 0) {
        setStatusMessage({status: "loading", message: "Fetching data from backend..."});

        await queryNodes([], rangeArray);

        const result_paths = {};
        for (const { global_index } of rangeArray) {
          const path = await getTreeData(global_index, local_bins.get(global_index).precision);
          result_paths[global_index] = path;
        }
        setLocalBins(prev => {
          const updated = new Map(prev);
        
          for (const { global_index } of rangeArray) {
            if (updated.has(global_index)) {
              const prevEntry = updated.get(global_index);
              
              updated.set(global_index, {
                ...prevEntry,
                path: result_paths?.[global_index] || null
              });

            }
          }
          return updated;
        });
      
      }
      
      setStatusMessage(null);
      isFetching.current = false;
    }, 400, { leading: false, trailing: true }),
    [isFetching.current, valueRef.current, xzoom]
  );

  useEffect(() => {
    if (valueRef.current) debouncedQuery(valueRef.current);
  }, [valueRef.current, xzoom]);

  useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);

  const localCoordinates = useMemo(() => {
    if (!valueRef.current) return [];
    const [lo, hi] = valueRef.current;
    const bufferFrac = 0.1;
    const range = hi - lo;
    return getLocalCoordinates(lo - bufferFrac * range, hi + bufferFrac * range);
  }, [valueRef.current]);

  useEffect(() => {
    if (tsconfig && tsconfig?.times?.values) {

      setTimes((prev) => {
        let newTime = [];
        let maxTime, minTime;
        maxTime = tsconfig?.times.values[1].toFixed(0); 
        minTime = tsconfig?.times.values[0].toFixed(0);

        const range = maxTime - minTime;
        
        // Calculate step size based on xzoom value
        // Finer steps for higher zoom (smaller intervals)
        let step;

          if (yzoom >= 18) step = 1;
          else if (yzoom >= 16) step = range/1000;
          else if (yzoom >= 14) step = range/500;
          else if (yzoom >= 12) step = range/100;
          else if (yzoom >= 10) step = range/50;
          else if (yzoom >= 8) step = range/10;
          else if (yzoom >= 5) step = range/5;
          else step = 1000;

        // const divisions = 10;
        
        // const rawStep = (maxTime - minTime) / divisions;
        // const stepSize = niceStep(rawStep);
        // console.log("stepSize", stepSize);
        // step = 1;
        for (let i = Number(maxTime); i >= Number(minTime); i -= step) {
          // For decimal steps, ensure correct floating point logic
          let roundedI = Math.abs(step) < 1 ? Number(i.toFixed(3)) : Math.round(i);
          let position = (maxTime - roundedI) / (maxTime - minTime);
          newTime.push({ position, text: roundedI });
        }
        return newTime;
      });
    }

  }, [tsconfig, yzoom]);

  return useMemo(() => ({
    bins: localBins,
    localCoordinates,
    times,
  }), [localBins, localCoordinates, times]);
};

export default useRegions;
