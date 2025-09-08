import { useState, useEffect, useCallback, useMemo } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import { useNavigate } from "react-router-dom";

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


function useConfig({backend}) {
  
  const [config, setConfig] = useState(null);
  const {isConnected} = backend;


  const globalBins = useMemo(() => {
    if (!config || !config.value || !config.new_intervals) return [];

    const intervals = config.new_intervals;

    let start = 0;
    let intervalsKeys = Object.keys(intervals);
        // calculate the genomemic distance between the intervals
    const widths = new Array(intervalsKeys.length+1);
    widths[0] = 0;
    for (let i = 0; i < intervalsKeys.length; i++) {
      const [s, e] = intervals[intervalsKeys[i]];
      widths[i + 1] = Math.max(0, e - s);
    }


    const weights = logNormalize(widths, intervalsKeys.length);

    const list = new Array(intervalsKeys.length + 1);
    list[0] = [start, start];
    for (let i = 0; i < intervalsKeys.length; i++) {
      const k = intervalsKeys[i];
      list[i + 1] = intervals[k];
    }


    const out = new Array(intervalsKeys.length);
    let acc = 0;
    for (let i = 0; i < intervalsKeys.length; i++) {
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
  }, [config]);

  const handleConfigUpdate = useCallback((data) => {
    if (data.role === "config") {
      console.log("config update", config,data.data)
      setConfig({...config, ...data.data});
    }
  }, [config]);

  useEffect(() => {
    if (!isConnected) return;
    // Subscribe to config updates
    websocketEvents.on("viz", handleConfigUpdate);
    // Cleanup subscription on unmount or disconnect
    return () => {
      console.log("unmounting")
      websocketEvents.off("viz", handleConfigUpdate);
    };
  }, [isConnected]);

  
  return useMemo(() => ({
    config, 
    setConfig,
    globalBins
  }), [config, setConfig, globalBins]);
};

export default useConfig;
