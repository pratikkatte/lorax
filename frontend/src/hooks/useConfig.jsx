import { useState, useEffect, useCallback, useMemo } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import { useNavigate } from "react-router-dom";


function useConfig({backend}) {
  const [tsconfig, setConfig] = useState(null);
  const {isConnected, queryConfig} = backend;

  const [globalBins, setGlobalBins] = useState(null);

  const [globalBpPerUnit, setGlobalBpPerUnit] = useState(null);

  const setWidth = useCallback((width, zoom) => {
    if (width && tsconfig){
      const genome_length = tsconfig.intervals[tsconfig.intervals.length - 1][1];
      setGlobalBpPerUnit((genome_length/tsconfig.intervals.length - 1));
    } 
  }, [tsconfig, globalBpPerUnit]);

  const handleConfigUpdate = useCallback((data) => {
    if (data.role === "config") {
      setConfig({...tsconfig, ...data.data});
    }
  }, [tsconfig]);

  const handleConfigGlobalBins = useCallback((data) => {
    if (data.role === "config-global-bins") {
      setGlobalBins(data.data.data);
    }
  }, [tsconfig]);

  useEffect(() => {
    if (globalBpPerUnit) {
      queryConfig(tsconfig, globalBpPerUnit);
    }
  }, [globalBpPerUnit]);

  useEffect(() => {
    if (!isConnected) return;
    // Subscribe to config updates
    websocketEvents.on("viz", handleConfigUpdate);

    websocketEvents.on("viz", handleConfigGlobalBins);
    // Cleanup subscription on unmount or disconnect
    return () => {
      console.log("unmounting")
      websocketEvents.off("viz", handleConfigUpdate);
    };
  }, [isConnected]);

  
  return useMemo(() => ({
    tsconfig, 
    setConfig,
    globalBins,
    setWidth,
    globalBpPerUnit
  }), [tsconfig, setConfig, globalBins, setWidth, globalBpPerUnit]);
};

export default useConfig;
