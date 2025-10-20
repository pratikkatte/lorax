
import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import debounce from "lodash.debounce";
import memoizeOne from "memoize-one";

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

// ────────────────────────────────
// getDynamicBpPerUnit
// ────────────────────────────────

function getDynamicBpPerUnit(globalBpPerUnit, zoom, baseZoom = 8) {
  const zoomDiff = zoom - baseZoom;
  const scaleFactor = Math.max(1, Math.pow(2, -zoomDiff));
  // return globalBpPerUnit * Math.floor(scaleFactor);
  return globalBpPerUnit * scaleFactor;
}

// ────────────────────────────────
// useRegions Hook
// ────────────────────────────────

const useRegions = ({ backend, valueRef, viewState, globalBpPerUnit, tsconfig, setStatusMessage, pathArray }) => {
  const { queryNodes, queryLocalBins } = backend;
  const [localBins, setLocalBins] = useState(null);
  // const localBinsRef = useRef(localBins);
  const isFetching = useRef(false);
  const [times, setTimes] = useState([]);

  // keep latest localBins for stable debounced callback
  // useEffect(() => { localBinsRef.current = localBins; }, [localBins]);

  const debouncedQuery = useMemo(
    () => debounce(async (val) => {
      if (isFetching.current) return;

      const [lo, hi] = val;
      const zoom = viewState["ortho"]?.zoom?.[0] ?? 8;
      const new_globalBp = getDynamicBpPerUnit(globalBpPerUnit, zoom);

      isFetching.current = true;
      const { local_bins, rangeArray } = await queryLocalBins(
        lo, hi, localBins, globalBpPerUnit, null, new_globalBp
      );
      setLocalBins(local_bins);

      if (rangeArray.length > 0) {
        setStatusMessage({status: "loading", message: "Fetching data from backend..."});

        const results = await queryNodes([], rangeArray);

        setLocalBins(prev => {
          // Clone the previous Map to preserve immutability
          const updated = new Map(prev);
        
          for (const { global_index } of rangeArray) {
            if (updated.has(global_index)) {
              const prevEntry = updated.get(global_index);
              
              updated.set(global_index, {
                ...prevEntry,
                path: results.paths?.[global_index] || null
              });
              // pathArray[global_index] = results.paths?.[global_index] || null;
            }
          }
          return updated;
        });
        
        // rangeArray.forEach(({ global_index }) => {
        //   local_bins[global_index].path = results.paths[global_index] || null;
        // });
      }
      
      setStatusMessage(null);
      isFetching.current = false;
    }, 400, { leading: false, trailing: true }),
    [isFetching.current, valueRef.current]
  );

  useEffect(() => {
    if (valueRef.current) debouncedQuery(valueRef.current);
  }, [valueRef.current]);

  useEffect(() => () => debouncedQuery.cancel(), [debouncedQuery]);

  const localCoordinates = useMemo(() => {
    if (!valueRef.current) return [];
    const [lo, hi] = valueRef.current;
    const bufferFrac = 0.1;
    const range = hi - lo;
    return getLocalCoordinates(lo - bufferFrac * range, hi + bufferFrac * range);
  }, [valueRef.current?.[0], valueRef.current?.[1]]);

  useEffect(() => {
    if (tsconfig && tsconfig?.times){
      setTimes((prev) => {
        let newTime = [];
        const maxTime = tsconfig.times[1];
        const minTime = tsconfig.times[0];
        for (let i = tsconfig.times[1]; i >= minTime; i--){
          if (i % 500 == 0) {
          let position = (maxTime - i) / (maxTime - minTime);
          newTime.push({position, text: i})
          }

      }
      // console.log('newTime', newTime);
      return newTime;
    })
    }
  }, [tsconfig]);

  return useMemo(() => ({
    bins: localBins,
    localCoordinates,
    times,
  }), [localBins, localCoordinates, times]);
};

export default useRegions;
