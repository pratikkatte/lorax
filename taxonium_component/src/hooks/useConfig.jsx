import { useState, useEffect, useCallback, useMemo } from "react";
import websocketEvents from "../webworkers/websocketEvents";

function useConfig({backend}) {
  const [config, setConfig] = useState(null);
  const {isConnected} = backend;
  
  const handleConfigUpdate = useCallback((data) => {
    console.log("config update", data)
    if (data.role === "config") {
      console.log("config update", data.config)
      setConfig(data.config);
    }
  }, [config]);

  useEffect(() => {
    console.log("isConnected", isConnected)
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
