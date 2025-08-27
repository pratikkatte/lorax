import { useState, useEffect, useCallback, useMemo } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import { useNavigate } from "react-router-dom";


function useConfig({backend}) {
  

  const [config, setConfig] = useState(null);
  const {isConnected} = backend;

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

  
  return useMemo(() => ({config, setConfig}), [config, setConfig]);
};

export default useConfig;
