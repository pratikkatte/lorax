import { useState, useEffect, useCallback, useMemo } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import { useNavigate } from "react-router-dom";


function useConfig({backend}) {
  const [config, setConfig] = useState(null);
  const {isConnected, queryConfig} = backend;

  const [globalBins, setGlobalBins] = useState(null);


  const handleConfigUpdate = useCallback((data) => {
    if (data.role === "config") {
      setConfig({...config, ...data.data});
    }
  }, [config]);

  const handleConfigGlobalBins = useCallback((data) => {
    if (data.role === "config-global-bins") {
      setGlobalBins(data.data.data);
    }
  }, [config]);

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
    config, 
    setConfig,
    globalBins
  }), [config, setConfig, globalBins]);
};

export default useConfig;
